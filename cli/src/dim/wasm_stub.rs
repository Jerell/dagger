// Stub implementations for WASM builds where wasmtime is not available
// These provide the same interface but skip unit processing

use crate::dim::error::DimError;
use crate::dim::types::UnitParseResult;
use std::collections::HashMap;

pub struct DimParser;

impl DimParser {
    pub fn new() -> Result<Self, DimError> {
        Err(DimError::WasmError(
            "Unit processing not available in WASM builds".to_string(),
        ))
    }

    pub fn parse_unit_string(&mut self, _input: &str) -> Result<UnitParseResult, DimError> {
        Err(DimError::WasmError(
            "Unit processing not available in WASM builds".to_string(),
        ))
    }

    pub fn convert_to_unit(
        &mut self,
        _value: f64,
        _from_unit: &str,
        _to_unit: &str,
    ) -> Result<f64, DimError> {
        Err(DimError::WasmError(
            "Unit processing not available in WASM builds".to_string(),
        ))
    }
}

pub struct UnitProcessor;

impl UnitProcessor {
    pub fn new() -> Self {
        Self
    }

    pub fn process_value(&mut self, value: &toml::Value) -> Result<toml::Value, DimError> {
        // In WASM builds, just return the value as-is
        Ok(value.clone())
    }

    pub fn process_hashmap(
        &mut self,
        extra: &HashMap<String, toml::Value>,
    ) -> Result<HashMap<String, toml::Value>, DimError> {
        // In WASM builds, just return the hashmap as-is
        Ok(extra.clone())
    }

    pub fn process_hashmap_with_schema(
        &mut self,
        extra: &HashMap<String, toml::Value>,
        _property_metadata: &HashMap<String, crate::schema::registry::PropertyMetadata>,
    ) -> Result<HashMap<String, toml::Value>, DimError> {
        // In WASM builds, just return the hashmap as-is
        Ok(extra.clone())
    }
}

pub struct UnitFormatter;

impl UnitFormatter {
    pub fn new() -> Self {
        Self
    }

    pub fn format_property(
        &mut self,
        _property_name: &str,
        value: &serde_json::Value,
        _block_type: Option<&str>,
        _unit_preferences: &crate::dim::formatter::UnitPreferences,
        _property_metadata: Option<&crate::schema::registry::PropertyMetadata>,
    ) -> Result<serde_json::Value, DimError> {
        // In WASM builds, just return the value as-is
        Ok(value.clone())
    }
}

#[derive(Clone, Default)]
pub struct UnitPreferences {
    pub query_overrides: HashMap<String, String>,
    pub block_types: HashMap<String, HashMap<String, String>>,
    pub dimensions: HashMap<String, String>,
    pub original_strings: HashMap<String, String>,
}

pub fn validate_dimension(
    _parser: &mut DimParser,
    _parse_result: &UnitParseResult,
    _expected_dimension: &str,
) -> Result<(), DimError> {
    Err(DimError::WasmError(
        "Unit validation not available in WASM builds".to_string(),
    ))
}

pub fn get_dimension(_parser: &mut DimParser, _parse_result: &UnitParseResult) -> Option<String> {
    None
}

pub fn looks_like_unit_string(_s: &str) -> bool {
    false
}
