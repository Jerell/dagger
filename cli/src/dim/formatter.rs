use crate::dim::error::DimError;
use crate::dim::ffi::DimParser;
use crate::schema::registry::PropertyMetadata;
use serde_json::Value as JsonValue;
use std::collections::HashMap;

/// Format a value with unit preferences
pub struct UnitFormatter {
    parser: Option<DimParser>,
}

impl UnitFormatter {
    pub fn new() -> Self {
        let parser = DimParser::new().ok();
        Self { parser }
    }
}

impl Default for UnitFormatter {
    fn default() -> Self {
        Self::new()
    }
}

impl UnitFormatter {
    /// Format a property value with unit preferences
    /// Returns the formatted value (may be converted to preferred unit)
    pub fn format_property(
        &mut self,
        property_name: &str,
        value: &JsonValue,
        block_type: Option<&str>,
        unit_preferences: &UnitPreferences,
        property_metadata: Option<&PropertyMetadata>,
    ) -> Result<JsonValue, DimError> {
        // Determine preferred unit using precedence:
        // 1. Query parameter override
        // 2. Block-type preference in config
        // 3. Dimension-level preference in config
        // 4. Schema defaultUnit
        // 5. Base SI unit (no conversion)

        let preferred_unit = unit_preferences
            .query_overrides
            .get(property_name)
            .or_else(|| {
                block_type
                    .and_then(|bt| unit_preferences.block_types.get(bt))
                    .and_then(|props| props.get(property_name))
            })
            .or_else(|| {
                property_metadata
                    .and_then(|meta| meta.dimension.as_ref())
                    .and_then(|dim| unit_preferences.dimensions.get(dim))
            })
            .or_else(|| property_metadata.and_then(|meta| meta.default_unit.as_ref()));

        // If no preferred unit, return value as-is
        let preferred_unit = match preferred_unit {
            Some(unit) => unit,
            None => return Ok(value.clone()),
        };

        // Check if value is a number (normalized unit value)
        let normalized_value = match value {
            JsonValue::Number(n) => n.as_f64(),
            JsonValue::String(s) => {
                // Try to parse as number
                s.parse::<f64>().ok()
            }
            _ => None,
        };

        let normalized_value = match normalized_value {
            Some(v) => v,
            None => return Ok(value.clone()), // Not a numeric value, return as-is
        };

        // Check if we have the original unit string
        let original_key = format!("_{}_original", property_name);
        let base_unit =
            if let Some(original_str) = unit_preferences.original_strings.get(&original_key) {
                // Parse original to get base unit
                if let Some(ref mut parser) = self.parser {
                    parser
                        .parse_unit_string(original_str)
                        .ok()
                        .map(|r| r.base_unit)
                } else {
                    None
                }
            } else {
                // Try to infer from property metadata
                property_metadata
                    .and_then(|meta| meta.dimension.as_ref())
                    .and_then(|dim| get_reference_unit_for_dimension(dim))
            };

        let base_unit = match base_unit {
            Some(unit) => unit,
            None => return Ok(value.clone()), // Can't determine base unit
        };

        // Convert from base unit to preferred unit
        if let Some(ref mut parser) = self.parser {
            match parser.convert_to_unit(normalized_value, &base_unit, preferred_unit) {
                Ok(converted_value) => {
                    // Format as "value unit" string (matching backend behavior)
                    let formatted = format!("{} {}", converted_value, preferred_unit);
                    Ok(JsonValue::String(formatted))
                }
                Err(e) => {
                    eprintln!(
                        "Warning: Failed to convert {} from {} to {}: {}",
                        property_name, base_unit, preferred_unit, e
                    );
                    Ok(value.clone()) // Return original on conversion failure
                }
            }
        } else {
            Ok(value.clone()) // Parser not available
        }
    }
}

/// Unit preferences for formatting
#[derive(Clone, Default)]
pub struct UnitPreferences {
    /// Query parameter overrides (highest priority)
    pub query_overrides: HashMap<String, String>, // property -> unit
    /// Block-type specific preferences from config
    pub block_types: HashMap<String, HashMap<String, String>>, // block_type -> {property -> unit}
    /// Dimension-level defaults from config
    pub dimensions: HashMap<String, String>, // dimension -> unit
    /// Original unit strings (from _property_original keys)
    pub original_strings: HashMap<String, String>, // _property_original -> original string
}

/// Get reference unit for a dimension (for conversion)
fn get_reference_unit_for_dimension(dimension: &str) -> Option<String> {
    match dimension {
        "pressure" => Some("Pa".to_string()),
        "length" => Some("m".to_string()),
        "temperature" => Some("K".to_string()),
        "time" => Some("s".to_string()),
        "mass" => Some("kg".to_string()),
        "energy" => Some("J".to_string()),
        "power" => Some("W".to_string()),
        "flow_rate" => Some("m³/s".to_string()),
        "velocity" => Some("m/s".to_string()),
        "force" => Some("N".to_string()),
        "volume" => Some("m³".to_string()),
        "area" => Some("m²".to_string()),
        "density" => Some("kg/m³".to_string()),
        _ => None,
    }
}
