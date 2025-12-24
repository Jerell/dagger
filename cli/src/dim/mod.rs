// Dimensional analysis and unit conversion using Zig dim library via WASM
pub mod detector;
pub mod error;
pub mod parser;
pub mod processor;
pub mod types;

pub use detector::looks_like_unit_string;
pub use error::DimError;
pub use parser::DimParser;
pub use processor::UnitProcessor;
pub use types::{UnitParseResult, UnitValue};
