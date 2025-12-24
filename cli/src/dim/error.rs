use std::fmt;

#[derive(Debug, Clone)]
pub enum DimError {
    WasmError(String),
    ParseError(String),
    ConversionError(String),
    InvalidUnit(String),
}

impl fmt::Display for DimError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DimError::WasmError(msg) => write!(f, "WASM error: {}", msg),
            DimError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            DimError::ConversionError(msg) => write!(f, "Conversion error: {}", msg),
            DimError::InvalidUnit(msg) => write!(f, "Invalid unit: {}", msg),
        }
    }
}

impl std::error::Error for DimError {}
