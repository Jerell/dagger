#[cfg(test)]
mod tests {
    use super::super::loader::load_network_from_files;
    use super::super::models::*;
    use std::collections::HashMap;
    use toml::Value;

    #[test]
    fn test_load_network_with_unit_strings() {
        let mut files = HashMap::new();
        files.insert(
            "branch-1.toml".to_string(),
            r#"
type = "branch"
label = "Test Branch"
position = { x = 0, y = 0 }

[[block]]
type = "Compressor"
pressure = "100 bar"
efficiency = 0.85
"#
            .to_string(),
        );

        let result = load_network_from_files(files, None);
        assert!(result.is_ok());

        if let Ok((network, _)) = result {
            if let Some(NodeData::Branch(branch)) = network.nodes.first() {
                let block = &branch.blocks[0];

                // Pressure should be normalized to a float (Pa) - WASM is required
                if let Some(Value::Float(pressure_value)) = block.extra.get("pressure") {
                    // 100 bar should be approximately 1e7 Pa
                    assert!(
                        (*pressure_value - 1e7).abs() < 1e5,
                        "Expected ~1e7 Pa, got {}",
                        pressure_value
                    );

                    // Original should be stored
                    let original = block
                        .extra
                        .get("_pressure_original")
                        .and_then(|v| v.as_str())
                        .expect("Original pressure string should be stored");
                    assert_eq!(original, "100 bar");
                } else {
                    panic!(
                        "Pressure should be parsed to Float, got: {:?}",
                        block.extra.get("pressure")
                    );
                }

                // Efficiency should remain unchanged
                if let Some(Value::Float(eff)) = block.extra.get("efficiency") {
                    assert_eq!(*eff, 0.85);
                }
            } else {
                panic!("Expected Branch node");
            }
        }
    }

    #[test]
    fn test_load_network_without_units() {
        let mut files = HashMap::new();
        files.insert(
            "branch-1.toml".to_string(),
            r#"
type = "branch"
label = "Test Branch"
position = { x = 0, y = 0 }

[[block]]
type = "Pipe"
length = 10
"#
            .to_string(),
        );

        let result = load_network_from_files(files, None);
        assert!(result.is_ok());

        if let Ok((network, _)) = result {
            if let Some(NodeData::Branch(branch)) = network.nodes.first() {
                let block = &branch.blocks[0];
                // Non-unit values should remain unchanged
                if let Some(Value::Integer(len)) = block.extra.get("length") {
                    assert_eq!(*len, 10);
                }
            } else {
                panic!("Expected Branch node");
            }
        }
    }
}
