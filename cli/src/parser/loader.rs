use crate::parser::models::*;
use crate::parser::validation::*;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use toml::Value;

pub fn load_network_from_directory<P: AsRef<Path>>(
    directory: P,
) -> Result<(Network, ValidationResult), Box<dyn std::error::Error>> {
    let dir_path = directory.as_ref();

    // Check if directory exists
    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path.display()).into());
    }

    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path.display()).into());
    }
    let mut nodes = Vec::new();
    let mut validation = ValidationResult::new();

    // Scan directory for TOML files
    let entries = fs::read_dir(dir_path)?;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("toml") {
            // Skip config.toml for now (will handle in Phase 2)
            if path.file_name().and_then(|n| n.to_str()) == Some("config.toml") {
                continue;
            }

            match load_node_from_file(&path) {
                Ok(node) => nodes.push(node),
                Err(e) => {
                    validation.add_error(
                        format!("Failed to parse {}: {}", path.display(), e),
                        Some(path.display().to_string()),
                    );
                }
            }
        }
    }

    // Build network graph
    let network = build_network(nodes, &mut validation)?;

    Ok((network, validation))
}

/// Load a network from file contents (filename -> content map)
/// This is used when files are read in Node.js and passed to WASM
pub fn load_network_from_files(
    files: HashMap<String, String>,
    _config_content: Option<String>,
) -> Result<(Network, ValidationResult), Box<dyn std::error::Error>> {
    let mut nodes = Vec::new();
    let mut validation = ValidationResult::new();

    // Process each TOML file
    for (filename, content) in files {
        // Skip config.toml (handled separately)
        if filename == "config.toml" {
            continue;
        }

        // Derive ID from filename (e.g., "branch-4.toml" -> "branch-4")
        let id = Path::new(&filename)
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or_else(|| format!("Invalid filename: {}", filename))?
            .to_string();

        match load_node_from_content(&content, &id, &filename) {
            Ok(node) => nodes.push(node),
            Err(e) => {
                validation.add_error(
                    format!("Failed to parse {}: {}", filename, e),
                    Some(filename.clone()),
                );
            }
        }
    }

    // Build network graph
    let network = build_network(nodes, &mut validation)?;

    Ok((network, validation))
}

fn load_node_from_file<P: AsRef<Path>>(path: P) -> Result<NodeData, Box<dyn std::error::Error>> {
    let path = path.as_ref();
    let content = fs::read_to_string(path)?;

    // Derive ID from filename (e.g., "branch-4.toml" -> "branch-4")
    let id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid filename")?
        .to_string();

    let filename = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    load_node_from_content(&content, &id, &filename)
}

fn load_node_from_content(
    content: &str,
    id: &str,
    _filename: &str,
) -> Result<NodeData, Box<dyn std::error::Error>> {
    let value: Value = toml::from_str(content)?;

    // Extract type to determine which struct to deserialize into
    let type_str = value
        .get("type")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'type' field")?;

    // Deserialize based on type
    let node = match type_str {
        "branch" => {
            let mut branch: BranchNode = toml::from_str(content)?;
            branch.base.id = id.to_string();
            NodeData::Branch(branch)
        }
        "labeledGroup" => {
            let mut group: GroupNode = toml::from_str(content)?;
            group.base.id = id.to_string();
            NodeData::Group(group)
        }
        "geographicAnchor" => {
            let mut anchor: GeographicAnchorNode = toml::from_str(content)?;
            anchor.base.id = id.to_string();
            NodeData::GeographicAnchor(anchor)
        }
        "geographicWindow" => {
            let mut window: GeographicWindowNode = toml::from_str(content)?;
            window.base.id = id.to_string();
            NodeData::GeographicWindow(window)
        }
        _ => {
            return Err(format!("Unknown node type: {}", type_str).into());
        }
    };

    Ok(node)
}

fn build_network(
    nodes: Vec<NodeData>,
    validation: &mut ValidationResult,
) -> Result<Network, Box<dyn std::error::Error>> {
    // Create node lookup map
    let node_map: std::collections::HashMap<_, _> =
        nodes.iter().map(|n| (n.id().to_string(), n)).collect();

    // Build edges from outgoing connections
    let mut edges = Vec::new();

    for node in &nodes {
        if let NodeData::Branch(branch) = node {
            for (idx, outgoing) in branch.outgoing.iter().enumerate() {
                let edge_id = format!("{}_{}", branch.base.id, outgoing.target);

                // Validate target exists
                if !node_map.contains_key(&outgoing.target) {
                    validation.add_warning(
                        format!("Outgoing target '{}' does not exist", outgoing.target),
                        Some(format!("{}/outgoing[{}]/target", branch.base.id, idx)),
                    );
                }

                edges.push(Edge {
                    id: edge_id,
                    source: branch.base.id.clone(),
                    target: outgoing.target.clone(),
                    data: EdgeData {
                        weight: outgoing.weight,
                    },
                });
            }
        }

        // Validate parent_id exists
        if let Some(parent_id) = node.base().parent_id.as_ref() {
            if !node_map.contains_key(parent_id) {
                validation.add_warning(
                    format!("Parent ID '{}' does not exist", parent_id),
                    Some(format!("{}/parentId", node.id())),
                );
            }
        }
    }

    // Determine network ID and label from directory name or use default
    let network = Network {
        id: "preset-1".to_string(),    // TODO: derive from directory name
        label: "Preset 1".to_string(), // TODO: derive from directory name or config
        nodes,
        edges,
    };

    Ok(network)
}
