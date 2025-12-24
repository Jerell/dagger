use lazy_static::lazy_static;
use regex::Regex;

lazy_static! {
    /// Regex pattern to detect unit strings
    /// Matches: number (optional decimal, optional scientific notation) + whitespace + letters/symbols
    /// Examples: "100 bar", "10.5 m", "5 kg/s", "1e3 Pa", "-20 C"
    static ref UNIT_PATTERN: Regex = Regex::new(
        r"^-?\d+(\.\d+)?([eE][+-]?\d+)?\s+[a-zA-Z/°µ]+"
    ).unwrap();
}

/// Check if a string looks like a unit expression
pub fn looks_like_unit_string(s: &str) -> bool {
    let trimmed = s.trim();
    // Must have at least a number and some letters
    if trimmed.is_empty() {
        return false;
    }

    // Check against regex pattern
    UNIT_PATTERN.is_match(trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unit_detection() {
        assert!(looks_like_unit_string("100 bar"));
        assert!(looks_like_unit_string("10.5 m"));
        assert!(looks_like_unit_string("5 kg/s"));
        assert!(looks_like_unit_string("1e3 Pa"));
        assert!(looks_like_unit_string("-20 C"));
        assert!(looks_like_unit_string("100 kPa"));

        assert!(!looks_like_unit_string("100"));
        assert!(!looks_like_unit_string("bar"));
        assert!(!looks_like_unit_string("hello world"));
        assert!(!looks_like_unit_string(""));
    }
}
