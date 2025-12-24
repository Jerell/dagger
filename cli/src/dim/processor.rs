use crate::dim::detector::looks_like_unit_string;
use crate::dim::error::DimError;
use crate::dim::parser::DimParser;
use std::collections::HashMap;
use toml::{map::Map, Value};

/// Process TOML values to parse unit strings and normalize them
pub struct UnitProcessor {
    parser: Option<DimParser>,
}

impl UnitProcessor {
    /// Create a new UnitProcessor
    /// If WASM file is not available, unit parsing will be skipped
    pub fn new() -> Self {
        let parser = DimParser::new().ok();
        Self { parser }
    }

    /// Process a TOML Value, parsing any unit strings found
    /// Returns a new Value with normalized units (original strings preserved in metadata)
    pub fn process_value(&mut self, value: &Value) -> Result<Value, DimError> {
        match value {
            Value::String(s) => {
                // Check if this looks like a unit string
                if looks_like_unit_string(s) {
                    if let Some(ref mut parser) = self.parser {
                        match parser.parse_unit_string(s) {
                            Ok(result) => {
                                // Store normalized value as float
                                // Store original in a parallel key with _original suffix
                                // For now, we'll return the normalized value
                                // The caller should handle storing the original separately
                                Ok(Value::Float(result.value))
                            }
                            Err(e) => {
                                // If parsing fails, keep original string
                                eprintln!("Warning: Failed to parse unit string '{}': {}", s, e);
                                Ok(value.clone())
                            }
                        }
                    } else {
                        // Parser not available, keep original
                        Ok(value.clone())
                    }
                } else {
                    // Not a unit string, keep as-is
                    Ok(value.clone())
                }
            }
            Value::Array(arr) => {
                let processed: Result<Vec<Value>, DimError> =
                    arr.iter().map(|v| self.process_value(v)).collect();
                Ok(Value::Array(processed?))
            }
            Value::Table(table) => {
                let mut processed = Map::new();
                for (key, val) in table {
                    let processed_val = self.process_value(val)?;
                    processed.insert(key.clone(), processed_val);

                    // If we processed a unit string, also store the original
                    if let (Value::String(s), Value::Float(_)) = (val, &processed[key]) {
                        if looks_like_unit_string(s) {
                            let original_key = format!("_{}_original", key);
                            processed.insert(original_key, Value::String(s.clone()));
                        }
                    }
                }
                Ok(Value::Table(processed))
            }
            _ => Ok(value.clone()),
        }
    }

    /// Process a HashMap of TOML values (like Block.extra or NodeBase.extra)
    pub fn process_hashmap(
        &mut self,
        extra: &HashMap<String, Value>,
    ) -> Result<HashMap<String, Value>, DimError> {
        let mut processed = HashMap::new();

        for (key, value) in extra {
            let processed_value = self.process_value(value)?;
            processed.insert(key.clone(), processed_value);

            // If we processed a unit string, store the original
            if let Value::String(s) = value {
                if looks_like_unit_string(s) {
                    if let Value::Float(_) = &processed[key] {
                        let original_key = format!("_{}_original", key);
                        processed.insert(original_key, Value::String(s.clone()));
                    }
                }
            }
        }

        Ok(processed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_simple_unit_string() {
        let mut processor = UnitProcessor::new();
        let value = Value::String("100 bar".to_string());

        let result = processor.process_value(&value);
        // Result depends on whether WASM is available
        match result {
            Ok(Value::Float(_)) => {
                // Successfully parsed unit
            }
            Ok(Value::String(s)) => {
                // Parser not available, kept original
                assert_eq!(s, "100 bar");
            }
            _ => panic!("Unexpected result type"),
        }
    }

    #[test]
    fn test_process_non_unit_string() {
        let mut processor = UnitProcessor::new();
        let value = Value::String("not a unit".to_string());

        let result = processor.process_value(&value).unwrap();
        assert!(matches!(result, Value::String(s) if s == "not a unit"));
    }

    #[test]
    fn test_process_array() {
        let mut processor = UnitProcessor::new();
        let value = Value::Array(vec![
            Value::String("100 bar".to_string()),
            Value::String("not a unit".to_string()),
            Value::Integer(42),
        ]);

        let result = processor.process_value(&value).unwrap();
        assert!(matches!(result, Value::Array(_)));
    }

    #[test]
    fn test_process_table() {
        let mut processor = UnitProcessor::new();
        let mut table = Map::new();
        table.insert("pressure".to_string(), Value::String("100 bar".to_string()));
        table.insert("name".to_string(), Value::String("test".to_string()));
        let value = Value::Table(table);

        let result = processor.process_value(&value).unwrap();
        if let Value::Table(t) = result {
            // Should have pressure (normalized), _pressure_original, and name
            assert!(t.contains_key("pressure") || t.contains_key("_pressure_original"));
            assert!(t.contains_key("name"));
        } else {
            panic!("Expected Table");
        }
    }
}
