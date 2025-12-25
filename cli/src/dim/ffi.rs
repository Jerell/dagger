// FFI bindings for the Zig dim library compiled as a C-compatible static library
// Uses bindgen-generated bindings from dim.h (as recommended in RUST_INTEGRATION.md)

use crate::dim::error::DimError;
use crate::dim::types::UnitParseResult;

// Include bindgen-generated bindings
#[cfg(not(target_arch = "wasm32"))]
#[allow(non_upper_case_globals)]
#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
mod bindings {
    include!(concat!(env!("OUT_DIR"), "/dim_bindings.rs"));
}

#[cfg(not(target_arch = "wasm32"))]
use bindings::*;

/// Parser for unit strings using the Zig dim library via native FFI
pub struct DimParser;

impl DimParser {
    /// Create a new DimParser
    pub fn new() -> Result<Self, DimError> {
        Ok(Self)
    }

    /// Parse a unit string (e.g., "100 bar", "10 m", "5 kg/s")
    /// Returns the value normalized to base SI units
    pub fn parse_unit_string(&mut self, input: &str) -> Result<UnitParseResult, DimError> {
        #[cfg(target_arch = "wasm32")]
        {
            return Err(DimError::WasmError(
                "Native dim library not available in WASM builds".to_string(),
            ));
        }

        #[cfg(not(target_arch = "wasm32"))]
        {
            let input_bytes = input.as_bytes();
            let mut out_ptr: *mut u8 = std::ptr::null_mut();
            let mut out_len: usize = 0;

            let result = unsafe {
                dim_eval(
                    input_bytes.as_ptr(),
                    input_bytes.len(),
                    &mut out_ptr,
                    &mut out_len,
                )
            };

            if result != 0 {
                return Err(DimError::ParseError(format!(
                    "dim_eval failed with code: {}",
                    result
                )));
            }

            if out_ptr.is_null() || out_len == 0 {
                return Err(DimError::ParseError(
                    "dim_eval returned null or empty result".to_string(),
                ));
            }

            // Convert the result to a Rust string (matching RUST_INTEGRATION.md pattern)
            let result_str = unsafe {
                let slice = std::slice::from_raw_parts(out_ptr, out_len);
                let string = String::from_utf8_lossy(slice).to_string();
                dim_free(out_ptr, out_len);
                string
            };

            // Parse the result (format: "value unit" or just "value")
            let parts: Vec<&str> = result_str.split_whitespace().collect();
            let value = if parts.is_empty() {
                return Err(DimError::ParseError(
                    "Empty result from dim_eval".to_string(),
                ));
            } else {
                parts[0]
                    .parse::<f64>()
                    .map_err(|e| DimError::ParseError(format!("Failed to parse value: {}", e)))?
            };

            let base_unit = if parts.len() > 1 {
                parts[1..].join(" ")
            } else {
                // If no unit, assume dimensionless
                "1".to_string()
            };

            Ok(UnitParseResult {
                value,
                base_unit,
                original: input.to_string(),
                formatted: Some(result_str),
            })
        }
    }

    /// Convert a value from one unit to another
    pub fn convert_to_unit(
        &mut self,
        value: f64,
        from_unit: &str,
        to_unit: &str,
    ) -> Result<f64, DimError> {
        // Build expression: value * from_unit / to_unit
        let expr = format!("{} {} / {}", value, from_unit, to_unit);
        let result = self.parse_unit_string(&expr)?;
        Ok(result.value)
    }

    /// Check if two unit expressions are dimensionally compatible
    pub fn check_unit_compatibility_raw(
        &mut self,
        expr_unit: &str,
        target_unit: &str,
    ) -> Result<bool, DimError> {
        // Try to evaluate: expr_unit + 1 target_unit
        // If dimensionally compatible, this will succeed
        let expr = format!("{} + 1 {}", expr_unit, target_unit);
        match self.parse_unit_string(&expr) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dim_eval_simple() {
        let mut parser = DimParser::new().expect("Failed to create parser");
        let result = parser.parse_unit_string("100 bar");
        match result {
            Ok(parse_result) => {
                println!(
                    "Parsed: {} {} (original: {})",
                    parse_result.value, parse_result.base_unit, parse_result.original
                );
                assert!(parse_result.value > 0.0);
                assert!(!parse_result.base_unit.is_empty());
            }
            Err(e) => {
                panic!("Failed to parse unit string: {:?}", e);
            }
        }
    }
}
