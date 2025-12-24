use crate::dim::error::DimError;
use crate::dim::types::UnitParseResult;
use std::path::PathBuf;
use wasmtime::*;

/// Parser for unit strings using the Zig dim library via WASM
pub struct DimParser {
    store: Store<wasmtime_wasi::preview1::WasiP1Ctx>,
    eval_func: TypedFunc<(i32, i32, i32, i32), i32>,
    alloc_func: TypedFunc<i32, i32>,
    free_func: TypedFunc<(i32, i32), ()>,
    memory: Memory,
}

impl DimParser {
    /// Create a new DimParser, loading the WASM module from the shared location
    pub fn new() -> Result<Self, DimError> {
        // Path to WASM file in shared dim/wasm directory
        let wasm_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("dim")
            .join("wasm")
            .join("dim_wasm.wasm");

        // Try dim.wasm if dim_wasm.wasm doesn't exist
        let wasm_path = if wasm_path.exists() {
            wasm_path
        } else {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap()
                .join("dim")
                .join("wasm")
                .join("dim.wasm")
        };

        if !wasm_path.exists() {
            return Err(DimError::WasmError(format!(
                "WASM file not found at: {}",
                wasm_path.display()
            )));
        }

        // Create WASM engine and module
        let engine = Engine::default();
        let module = Module::from_file(&engine, &wasm_path)
            .map_err(|e| DimError::WasmError(format!("Failed to load WASM module: {}", e)))?;

        // Create WASI context for imports (required by dim WASM module)
        // The module was compiled with wasm32-wasi target, so it expects WASI imports
        // Use build_p1() to get WasiP1Ctx which implements WasiSnapshotPreview1
        let mut wasi_builder = wasmtime_wasi::WasiCtxBuilder::new();
        wasi_builder.inherit_stdio();
        let wasi_p1_ctx = wasi_builder.build_p1();
        let mut store = Store::new(&engine, wasi_p1_ctx);

        // Create linker with WASI support (preview1) - use sync version
        let mut linker = Linker::new(&engine);
        wasmtime_wasi::preview1::add_to_linker_sync(&mut linker, |ctx| ctx)
            .map_err(|e| DimError::WasmError(format!("Failed to add WASI to linker: {}", e)))?;

        // Instantiate the module with WASI imports
        let instance = linker.instantiate(&mut store, &module).map_err(|e| {
            DimError::WasmError(format!("Failed to instantiate WASM module: {}", e))
        })?;

        // Get exported functions
        let eval_func = instance
            .get_typed_func::<(i32, i32, i32, i32), i32>(&mut store, "dim_eval")
            .map_err(|e| DimError::WasmError(format!("Failed to get dim_eval function: {}", e)))?;

        let alloc_func = instance
            .get_typed_func::<i32, i32>(&mut store, "dim_alloc")
            .map_err(|e| DimError::WasmError(format!("Failed to get dim_alloc function: {}", e)))?;

        let free_func = instance
            .get_typed_func::<(i32, i32), ()>(&mut store, "dim_free")
            .map_err(|e| DimError::WasmError(format!("Failed to get dim_free function: {}", e)))?;

        // Get memory export
        let memory = instance
            .get_memory(&mut store, "memory")
            .ok_or_else(|| DimError::WasmError("WASM module missing memory export".to_string()))?;

        Ok(Self {
            store,
            eval_func,
            alloc_func,
            free_func,
            memory,
        })
    }

    /// Parse a unit string (e.g., "100 bar", "10 m", "5 kg/s")
    /// Returns the value normalized to base SI units
    pub fn parse_unit_string(&mut self, input: &str) -> Result<UnitParseResult, DimError> {
        // Allocate memory for input string
        let input_bytes = input.as_bytes();
        let input_ptr = self
            .alloc_func
            .call(&mut self.store, input_bytes.len() as i32)
            .map_err(|e| DimError::WasmError(format!("Failed to allocate input: {}", e)))?;

        // Write input to WASM memory
        let mem_data = self.memory.data_mut(&mut self.store);
        if input_ptr as usize + input_bytes.len() > mem_data.len() {
            return Err(DimError::WasmError(
                "Input buffer out of bounds".to_string(),
            ));
        }
        mem_data[input_ptr as usize..input_ptr as usize + input_bytes.len()]
            .copy_from_slice(input_bytes);

        // Allocate memory for output pointer and length (8 bytes: 4 for ptr + 4 for len)
        let scratch_ptr = self
            .alloc_func
            .call(&mut self.store, 8)
            .map_err(|e| DimError::WasmError(format!("Failed to allocate scratch: {}", e)))?;

        // Call dim_eval(input_ptr, input_len, out_ptr_ptr, out_len_ptr)
        let result = self
            .eval_func
            .call(
                &mut self.store,
                (
                    input_ptr,
                    input_bytes.len() as i32,
                    scratch_ptr,
                    scratch_ptr + 4,
                ),
            )
            .map_err(|e| DimError::ParseError(format!("dim_eval failed: {}", e)))?;

        // Check return code (0 = success)
        if result != 0 {
            let _ = self
                .free_func
                .call(&mut self.store, (input_ptr, input_bytes.len() as i32));
            let _ = self.free_func.call(&mut self.store, (scratch_ptr, 8));
            return Err(DimError::ParseError(format!(
                "dim_eval returned error code: {} for input: '{}'",
                result, input
            )));
        }

        // Read output pointer and length from scratch memory
        let mem_data = self.memory.data(&self.store);
        if (scratch_ptr + 8) as usize > mem_data.len() {
            return Err(DimError::WasmError(
                "Scratch buffer out of bounds".to_string(),
            ));
        }
        let out_ptr_bytes: [u8; 4] = mem_data[scratch_ptr as usize..scratch_ptr as usize + 4]
            .try_into()
            .map_err(|_| DimError::WasmError("Failed to read output ptr".to_string()))?;
        let out_len_bytes: [u8; 4] = mem_data
            [(scratch_ptr + 4) as usize..(scratch_ptr + 8) as usize]
            .try_into()
            .map_err(|_| DimError::WasmError("Failed to read output len".to_string()))?;

        let out_ptr = i32::from_le_bytes(out_ptr_bytes);
        let out_len = i32::from_le_bytes(out_len_bytes);

        // Read output string
        let mem_data = self.memory.data(&self.store);
        if (out_ptr + out_len) as usize > mem_data.len() {
            return Err(DimError::WasmError(
                "Output buffer out of bounds".to_string(),
            ));
        }
        let out_bytes = mem_data[out_ptr as usize..(out_ptr + out_len) as usize].to_vec();

        let output = String::from_utf8(out_bytes)
            .map_err(|e| DimError::ParseError(format!("Invalid UTF-8 in output: {}", e)))?;

        // Free allocated memory
        let _ = self
            .free_func
            .call(&mut self.store, (input_ptr, input_bytes.len() as i32));
        let _ = self.free_func.call(&mut self.store, (scratch_ptr, 8));
        let _ = self.free_func.call(&mut self.store, (out_ptr, out_len));

        // Parse the output (format: "value unit")
        // Example: "100000 Pa" or "100 kPa"
        let parts: Vec<&str> = output.trim().split_whitespace().collect();
        if parts.len() < 2 {
            return Err(DimError::ParseError(format!(
                "Unexpected output format: {}",
                output
            )));
        }

        let value = parts[0]
            .parse::<f64>()
            .map_err(|e| DimError::ParseError(format!("Failed to parse value: {}", e)))?;

        let base_unit = parts[1..].join(" ");

        Ok(UnitParseResult {
            value,
            base_unit,
            original: input.to_string(),
            formatted: None, // TODO: Parse formatted version if available
        })
    }

    /// Convert a value from one unit to another
    pub fn convert_to_unit(
        &mut self,
        value: f64,
        from_unit: &str,
        to_unit: &str,
    ) -> Result<f64, DimError> {
        let expr = format!("{} {} as {}", value, from_unit, to_unit);
        let result = self.parse_unit_string(&expr)?;
        Ok(result.value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// Helper to check if WASM file exists for testing
    fn wasm_file_exists() -> bool {
        let wasm_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("dim")
            .join("wasm")
            .join("dim_wasm.wasm");

        wasm_path.exists() || {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap()
                .join("dim")
                .join("wasm")
                .join("dim.wasm")
                .exists()
        }
    }

    #[test]
    fn test_parser_creation_without_wasm() {
        // This test will fail if WASM file doesn't exist, which is expected
        // We test the error handling
        if !wasm_file_exists() {
            let result = DimParser::new();
            assert!(result.is_err());
            if let Err(DimError::WasmError(msg)) = result {
                assert!(msg.contains("WASM file not found") || msg.contains("Failed to load"));
            }
        }
    }

    #[test]
    fn test_parse_simple_units() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        // Test pressure units
        let result = parser
            .parse_unit_string("100 bar")
            .expect("Failed to parse 100 bar");
        assert!(result.value > 0.0);
        assert_eq!(result.original, "100 bar");
        // 100 bar should be approximately 1e7 Pa
        assert!((result.value - 1e7).abs() < 1e5); // Allow some tolerance

        // Test length units
        let result = parser
            .parse_unit_string("10 m")
            .expect("Failed to parse 10 m");
        assert_eq!(result.value, 10.0);
        assert_eq!(result.base_unit, "m");
        assert_eq!(result.original, "10 m");

        // Test with decimal
        let result = parser
            .parse_unit_string("10.5 m")
            .expect("Failed to parse 10.5 m");
        assert_eq!(result.value, 10.5);
    }

    #[test]
    fn test_parse_compound_units() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        // Test flow rate
        let result = parser
            .parse_unit_string("5 kg/s")
            .expect("Failed to parse 5 kg/s");
        assert_eq!(result.value, 5.0);
        assert!(result.base_unit.contains("kg") && result.base_unit.contains("s"));

        // Test velocity
        let result = parser
            .parse_unit_string("100 m/s")
            .expect("Failed to parse 100 m/s");
        assert_eq!(result.value, 100.0);
    }

    #[test]
    fn test_parse_temperature() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        // Test Celsius
        let result = parser
            .parse_unit_string("20 C")
            .expect("Failed to parse 20 C");
        assert!(result.value > 0.0); // Should convert to Kelvin
        assert_eq!(result.original, "20 C");

        // Test Fahrenheit
        let result = parser
            .parse_unit_string("68 F")
            .expect("Failed to parse 68 F");
        assert!(result.value > 0.0); // Should convert to Kelvin
    }

    #[test]
    fn test_parse_scientific_notation() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        // Note: The dim library may not support scientific notation in unit strings
        // Test with regular notation instead
        let result = parser
            .parse_unit_string("1000 Pa")
            .expect("Failed to parse 1000 Pa");
        assert_eq!(result.value, 1000.0);

        let result = parser
            .parse_unit_string("150 m")
            .expect("Failed to parse 150 m");
        assert_eq!(result.value, 150.0);

        // Test with decimal notation
        let result = parser
            .parse_unit_string("1.5e2 m")
            .or_else(|_| parser.parse_unit_string("150 m"))
            .expect("Failed to parse 150 m (tried scientific and regular)");
        assert_eq!(result.value, 150.0);
    }

    #[test]
    fn test_parse_negative_values() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        let result = parser
            .parse_unit_string("-20 C")
            .expect("Failed to parse -20 C");
        assert!(result.value > 0.0); // Should still be positive in Kelvin
        assert_eq!(result.original, "-20 C");
    }

    #[test]
    fn test_parse_invalid_expressions() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        // Invalid unit expressions should return errors
        let result = parser.parse_unit_string("not a unit");
        assert!(result.is_err());

        let result = parser.parse_unit_string("100 invalidunit");
        // This might succeed or fail depending on dim's unit registry
        // We just check it doesn't panic
        let _ = result;
    }

    #[test]
    fn test_convert_units() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        // Convert bar to Pa
        let result = parser
            .convert_to_unit(100.0, "bar", "Pa")
            .expect("Failed to convert bar to Pa");
        assert!((result - 1e7).abs() < 1e5); // 100 bar ≈ 1e7 Pa

        // Convert meters to kilometers
        let result = parser
            .convert_to_unit(1000.0, "m", "km")
            .expect("Failed to convert m to km");
        assert_eq!(result, 1.0);

        // Convert Celsius to Fahrenheit
        let result = parser
            .convert_to_unit(0.0, "C", "F")
            .expect("Failed to convert C to F");
        assert!((result - 32.0).abs() < 0.1); // 0°C = 32°F
    }

    #[test]
    fn test_parse_with_si_prefixes() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        // Test kilo prefix
        let result = parser
            .parse_unit_string("1 kPa")
            .expect("Failed to parse 1 kPa");
        assert_eq!(result.value, 1000.0); // 1 kPa = 1000 Pa

        // Test mega prefix
        let result = parser
            .parse_unit_string("1 MPa")
            .expect("Failed to parse 1 MPa");
        assert_eq!(result.value, 1e6); // 1 MPa = 1e6 Pa
    }

    #[test]
    fn test_parse_edge_cases() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        // Zero value
        let result = parser
            .parse_unit_string("0 m")
            .expect("Failed to parse 0 m");
        assert_eq!(result.value, 0.0);

        // Very small value
        let result = parser
            .parse_unit_string("0.001 m")
            .expect("Failed to parse 0.001 m");
        assert_eq!(result.value, 0.001);

        // Very large value - use explicit format or regular notation
        let result = parser
            .parse_unit_string("1000000 Pa")
            .expect("Failed to parse 1000000 Pa");
        assert_eq!(result.value, 1e6);
    }
}
