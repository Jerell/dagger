use crate::dim::error::DimError;
use crate::dim::parser::DimParser;
use crate::dim::types::UnitParseResult;

/// Map dimension names to reference units for compatibility checking
/// Uses base SI units as reference points
fn get_reference_unit_for_dimension(dimension: &str) -> Option<&'static str> {
    match dimension {
        "pressure" => Some("1 Pa"),
        "length" => Some("1 m"),
        "temperature" => Some("1 K"),
        "time" => Some("1 s"),
        "mass" => Some("1 kg"),
        "energy" => Some("1 J"),
        "power" => Some("1 W"),
        "flow_rate" => Some("1 m³/s"),
        "velocity" => Some("1 m/s"),
        "force" => Some("1 N"),
        "volume" => Some("1 m³"),
        "area" => Some("1 m²"),
        "density" => Some("1 kg/m³"),
        _ => None,
    }
}

/// Check if two unit expressions are dimensionally compatible using the dim library
/// This uses the dim library's dimensional analysis by trying to add the units together
/// If the addition succeeds, the units are compatible (same dimension)
fn check_unit_compatibility(
    parser: &mut DimParser,
    expr: &str,
    target: &str,
) -> Result<bool, DimError> {
    // Try to evaluate: expr + target
    // If this succeeds, the units are compatible
    let addition_expr = format!("{} + {}", expr, target);
    match parser.parse_unit_string(&addition_expr) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Validate that a parsed unit matches the expected dimension using the dim library
/// This uses dimensional analysis by checking if the parsed unit is compatible with
/// a reference unit for the expected dimension
pub fn validate_dimension(
    parser: &mut DimParser,
    parse_result: &UnitParseResult,
    expected_dimension: &str,
) -> Result<(), DimError> {
    // Get reference unit for the expected dimension
    let reference_unit = get_reference_unit_for_dimension(expected_dimension).ok_or_else(|| {
        DimError::ParseError(format!("Unknown dimension type: {}", expected_dimension))
    })?;

    // Check if the parsed unit is compatible with the reference unit
    // Use the original input string for compatibility check
    let is_compatible = check_unit_compatibility(parser, &parse_result.original, reference_unit)?;

    if !is_compatible {
        return Err(DimError::ParseError(format!(
            "Dimension mismatch: expected '{}', but parsed unit '{}' is not compatible with reference unit '{}'",
            expected_dimension, parse_result.original, reference_unit
        )));
    }

    Ok(())
}

/// Get the dimension type of a parsed unit by checking compatibility with known dimensions
/// Returns the first matching dimension, or None if no match is found
pub fn get_dimension(parser: &mut DimParser, parse_result: &UnitParseResult) -> Option<String> {
    // List of dimensions to check (in order of likelihood/commonness)
    let dimensions = [
        "pressure",
        "length",
        "temperature",
        "time",
        "mass",
        "energy",
        "power",
        "flow_rate",
        "velocity",
        "force",
        "volume",
        "area",
        "density",
    ];

    for dimension in dimensions.iter() {
        if let Some(reference_unit) = get_reference_unit_for_dimension(dimension) {
            if check_unit_compatibility(parser, &parse_result.original, reference_unit)
                .unwrap_or(false)
            {
                return Some(dimension.to_string());
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dim::parser::DimParser;

    fn wasm_file_exists() -> bool {
        use std::path::PathBuf;
        let wasm_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("dim")
            .join("wasm")
            .join("dim_wasm.wasm");
        let wasm_path_alt = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("dim")
            .join("wasm")
            .join("dim.wasm");
        wasm_path.exists() || wasm_path_alt.exists()
    }

    #[test]
    fn test_check_unit_compatibility() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        // Pressure units should be compatible
        assert!(check_unit_compatibility(&mut parser, "100 bar", "1 Pa").unwrap());
        assert!(check_unit_compatibility(&mut parser, "10 psi", "1 Pa").unwrap());

        // Length units should be compatible
        assert!(check_unit_compatibility(&mut parser, "10 m", "1 m").unwrap());
        assert!(check_unit_compatibility(&mut parser, "5 km", "1 m").unwrap());

        // Pressure and length should NOT be compatible
        assert!(!check_unit_compatibility(&mut parser, "100 bar", "1 m").unwrap());
        assert!(!check_unit_compatibility(&mut parser, "10 m", "1 Pa").unwrap());
    }

    #[test]
    fn test_validate_dimension() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        let result = parser
            .parse_unit_string("100 bar")
            .expect("Failed to parse 100 bar");

        // Should pass for correct dimension
        assert!(validate_dimension(&mut parser, &result, "pressure").is_ok());

        // Should fail for wrong dimension
        assert!(validate_dimension(&mut parser, &result, "length").is_err());
    }

    #[test]
    fn test_get_dimension() {
        if !wasm_file_exists() {
            return;
        }

        let mut parser = DimParser::new().expect("Failed to create parser");

        // Test pressure
        let result = parser
            .parse_unit_string("100 bar")
            .expect("Failed to parse 100 bar");
        assert_eq!(
            get_dimension(&mut parser, &result),
            Some("pressure".to_string())
        );

        // Test length
        let result = parser
            .parse_unit_string("10 m")
            .expect("Failed to parse 10 m");
        assert_eq!(
            get_dimension(&mut parser, &result),
            Some("length".to_string())
        );

        // Test temperature
        let result = parser
            .parse_unit_string("20 C")
            .expect("Failed to parse 20 C");
        assert_eq!(
            get_dimension(&mut parser, &result),
            Some("temperature".to_string())
        );
    }
}
