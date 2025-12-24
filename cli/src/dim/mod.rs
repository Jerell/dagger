// Dimensional analysis and unit conversion using Zig dim library
// Native builds: Use FFI to call native dim library
// WASM builds: Use stubs (dim library can't be compiled to WASM)

#[cfg(not(target_arch = "wasm32"))]
pub mod detector;
pub mod error;
#[cfg(not(target_arch = "wasm32"))]
pub mod ffi;
#[cfg(not(target_arch = "wasm32"))]
pub mod formatter;
// Old WASM-based parser - no longer used, replaced by ffi.rs
// #[cfg(not(target_arch = "wasm32"))]
// pub mod parser;
#[cfg(not(target_arch = "wasm32"))]
pub mod processor;
pub mod types;
#[cfg(not(target_arch = "wasm32"))]
pub mod validator;

// Stub implementations for WASM builds
#[cfg(target_arch = "wasm32")]
pub mod wasm_stub;

#[cfg(not(target_arch = "wasm32"))]
pub use detector::looks_like_unit_string;
#[cfg(target_arch = "wasm32")]
pub use wasm_stub::looks_like_unit_string;

pub use error::DimError;

#[cfg(not(target_arch = "wasm32"))]
pub use formatter::{UnitFormatter, UnitPreferences};
#[cfg(target_arch = "wasm32")]
pub use wasm_stub::{UnitFormatter, UnitPreferences};

// Use FFI parser for native builds, WASM stubs for WASM builds
#[cfg(not(target_arch = "wasm32"))]
pub use ffi::DimParser;
#[cfg(target_arch = "wasm32")]
pub use wasm_stub::DimParser;

#[cfg(not(target_arch = "wasm32"))]
pub use processor::UnitProcessor;
#[cfg(target_arch = "wasm32")]
pub use wasm_stub::UnitProcessor;

pub use types::{UnitParseResult, UnitValue};

#[cfg(not(target_arch = "wasm32"))]
pub use validator::{get_dimension, validate_dimension};
#[cfg(target_arch = "wasm32")]
pub use wasm_stub::{get_dimension, validate_dimension};
