#[cfg(not(target_arch = "wasm32"))]
use crate::dim::processor::UnitProcessor;
use crate::parser::models::*;
use crate::parser::validation::*;
#[cfg(not(target_arch = "wasm32"))]
use crate::schema::registry::SchemaRegistry;
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
    #[allow(unused_mut)] // mut needed for process_units_in_node in non-WASM builds
    let mut node = match type_str {
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
        "image" => {
            let mut image: ImageNode = toml::from_str(content)?;
            image.base.id = id.to_string();
            NodeData::Image(image)
        }
        _ => {
            return Err(format!("Unknown node type: {}", type_str).into());
        }
    };

    // Process unit strings in the node (no schema registry at this level for now)
    // Unit processing is disabled for WASM builds (wasmtime can't be compiled to WASM)
    #[cfg(not(target_arch = "wasm32"))]
    {
        process_units_in_node(&mut node, None, None)?;
    }

    Ok(node)
}

/// Process unit strings in a node, converting them to normalized values
/// Optionally uses schema registry for dimension-aware parsing and validation
#[cfg(not(target_arch = "wasm32"))]
fn process_units_in_node(
    node: &mut NodeData,
    schema_registry: Option<&SchemaRegistry>,
    schema_version: Option<&str>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut processor = UnitProcessor::new();

    match node {
        NodeData::Branch(branch) => {
            // Process base node extra properties (no schema for nodes, use regular processing)
            branch.base.extra = processor.process_hashmap(&branch.base.extra)?;

            // Process blocks with schema-aware processing if available
            for block in &mut branch.blocks {
                if let (Some(registry), Some(version)) = (schema_registry, schema_version) {
                    // Try to get schema for this block type
                    if let Some(schema) = registry.get_schema(version, &block.type_) {
                        // Use schema-aware processing
                        block.extra = processor
                            .process_hashmap_with_schema(&block.extra, &schema.properties)?;
                    } else {
                        // No schema found, use regular processing
                        block.extra = processor.process_hashmap(&block.extra)?;
                    }
                } else {
                    // No schema registry, use regular processing
                    block.extra = processor.process_hashmap(&block.extra)?;
                }
            }
        }
        NodeData::Group(group) => {
            group.base.extra = processor.process_hashmap(&group.base.extra)?;
        }
        NodeData::GeographicAnchor(anchor) => {
            anchor.base.extra = processor.process_hashmap(&anchor.base.extra)?;
        }
        NodeData::GeographicWindow(window) => {
            window.base.extra = processor.process_hashmap(&window.base.extra)?;
        }
        NodeData::Image(image) => {
            image.base.extra = processor.process_hashmap(&image.base.extra)?;
        }
    }

    Ok(())
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
