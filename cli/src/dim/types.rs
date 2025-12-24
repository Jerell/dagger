/// Result of parsing a unit string
#[derive(Debug, Clone)]
pub struct UnitParseResult {
    /// Numeric value in base SI units
    pub value: f64,
    /// Base SI unit (e.g., "Pa", "m", "K", "s")
    pub base_unit: String,
    /// Original input string for display
    pub original: String,
    /// Formatted string with appropriate SI prefix (e.g., "1.0 kPa" instead of "1000 Pa")
    pub formatted: Option<String>,
}

/// Represents a value that may or may not be a unit expression
#[derive(Debug, Clone)]
pub enum UnitValue {
    /// Successfully parsed and normalized to base SI units
    Parsed(UnitParseResult),
    /// Could not parse as unit expression (keep as-is)
    Unparsed(String),
}
