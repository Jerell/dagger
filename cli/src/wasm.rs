// WebAssembly bindings for the Dagger API
use crate::parser;
use crate::query;
use crate::schema;
use crate::scope;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct DaggerWasm {
    // We'll store network data here if needed
}

impl Default for DaggerWasm {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl DaggerWasm {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {}
    }

    /// Load a network from file contents (JSON string mapping filename -> content)
    /// Returns JSON string of the network
    #[wasm_bindgen]
    pub fn load_network_from_files(
        &self,
        files_json: &str,
        config_content: Option<String>,
    ) -> Result<String, JsValue> {
        // Parse the JSON string into a HashMap
        let files: std::collections::HashMap<String, String> = serde_json::from_str(files_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse files JSON: {}", e)))?;

        let (network, _validation) = parser::load_network_from_files(files, config_content)
            .map_err(|e| JsValue::from_str(&format!("Failed to load network: {}", e)))?;

        let json = serde_json::to_string(&network)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize network: {}", e)))?;

        Ok(json)
    }

    /// Load a network from a directory path (for CLI use)
    /// Returns JSON string of the network
    #[wasm_bindgen]
    pub fn load_network(&self, path: &str) -> Result<String, JsValue> {
        let (network, _validation) = parser::load_network_from_directory(path)
            .map_err(|e| JsValue::from_str(&format!("Failed to load network: {}", e)))?;

        let json = serde_json::to_string(&network)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize network: {}", e)))?;

        Ok(json)
    }

    /// Query the network using query path syntax
    /// files_json: JSON string mapping filename -> content
    /// Returns JSON string of the query result
    #[wasm_bindgen]
    pub fn query_from_files(
        &self,
        files_json: &str,
        config_content: Option<String>,
        query_str: &str,
    ) -> Result<String, JsValue> {
        // Parse the JSON string into a HashMap
        let files: std::collections::HashMap<String, String> = serde_json::from_str(files_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse files JSON: {}", e)))?;

        // Load network
        let (network, _validation) = parser::load_network_from_files(files, config_content.clone())
            .map_err(|e| JsValue::from_str(&format!("Failed to load network: {}", e)))?;

        // Parse query path and extract unit overrides
        // Note: Unit preferences are not available in WASM builds (wasmtime can't be compiled to WASM)
        // Unit processing happens during TOML loading, but unit formatting in queries is disabled
        let (query_path, _unit_overrides) = query::parser::parse_query_path_with_params(query_str)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse query: {}", e)))?;

        // Load config for scope resolution
        let config = if let Some(config_content) = config_content {
            scope::config::Config::load_from_str(&config_content)
                .map_err(|e| JsValue::from_str(&format!("Failed to load config: {}", e)))?
        } else {
            scope::config::Config::empty()
        };
        let resolver = scope::resolver::ScopeResolver::new(config);

        // Execute query (unit preferences disabled in WASM builds)
        let executor = query::executor::QueryExecutor::with_scope_resolver(&network, &resolver);
        let result = executor
            .execute(&query_path)
            .map_err(|e| JsValue::from_str(&format!("Query error: {}", e)))?;

        // Serialize result
        let json = serde_json::to_string(&result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))?;

        Ok(json)
    }

    /// Get all nodes in the network
    /// Returns JSON string array of nodes
    #[wasm_bindgen]
    pub fn get_nodes(
        &self,
        network_path: &str,
        node_type: Option<String>,
    ) -> Result<String, JsValue> {
        let (network, _validation) = parser::load_network_from_directory(network_path)
            .map_err(|e| JsValue::from_str(&format!("Failed to load network: {}", e)))?;

        let nodes: Vec<_> = network
            .nodes
            .iter()
            .filter(|n| {
                if let Some(ref filter_type) = node_type {
                    match n {
                        parser::models::NodeData::Branch(b) => filter_type == &b.base.type_,
                        parser::models::NodeData::Group(g) => filter_type == &g.base.type_,
                        parser::models::NodeData::GeographicAnchor(a) => {
                            filter_type == &a.base.type_
                        }
                        parser::models::NodeData::GeographicWindow(w) => {
                            filter_type == &w.base.type_
                        }
                    }
                } else {
                    true
                }
            })
            .collect();

        let json = serde_json::to_string(&nodes)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize nodes: {}", e)))?;

        Ok(json)
    }

    /// Resolve a property with scope information
    /// Returns JSON string with both value and scope: {"value": ..., "scope": "block"|"branch"|"group"|"global"}
    #[wasm_bindgen]
    pub fn resolve_property_with_scope(
        &self,
        files_json: &str,
        config_content: Option<String>,
        node_id: &str,
        block_index: usize,
        property: &str,
    ) -> Result<String, JsValue> {
        // Parse the JSON string into a HashMap
        let files: std::collections::HashMap<String, String> = serde_json::from_str(files_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse files JSON: {}", e)))?;

        // Load network
        let (network, _validation) = parser::load_network_from_files(files, config_content.clone())
            .map_err(|e| JsValue::from_str(&format!("Failed to load network: {}", e)))?;

        // Load config for scope resolution
        let config = if let Some(config_content) = config_content {
            scope::config::Config::load_from_str(&config_content)
                .map_err(|e| JsValue::from_str(&format!("Failed to load config: {}", e)))?
        } else {
            scope::config::Config::empty()
        };
        let resolver = scope::resolver::ScopeResolver::new(config);

        // Find the branch node
        let branch_node = network
            .nodes
            .iter()
            .find_map(|n| match n {
                parser::models::NodeData::Branch(b) if b.base.id == node_id => Some(b),
                _ => None,
            })
            .ok_or_else(|| JsValue::from_str(&format!("Node '{}' not found", node_id)))?;

        // Get the block
        let block = branch_node.blocks.get(block_index).ok_or_else(|| {
            JsValue::from_str(&format!(
                "Block index {} out of range ({} blocks)",
                block_index,
                branch_node.blocks.len()
            ))
        })?;

        // Find the group if parent_id exists
        let group = branch_node.base.parent_id.as_ref().and_then(|parent_id| {
            network.nodes.iter().find_map(|n| match n {
                parser::models::NodeData::Group(g) if g.base.id == *parent_id => Some(g),
                _ => None,
            })
        });

        // Resolve the property with scope
        let result = resolver.resolve_property_with_scope(property, block, branch_node, group);

        match result {
            Some((value, scope_level)) => {
                // Convert TOML Value to JSON Value
                let json_value = query::executor::toml_to_json(&value);

                // Convert scope level to string
                let scope_str = match scope_level {
                    scope::config::ScopeLevel::Block => "block",
                    scope::config::ScopeLevel::Branch => "branch",
                    scope::config::ScopeLevel::Group => "group",
                    scope::config::ScopeLevel::Global => "global",
                };

                // Return both value and scope
                let result_obj = serde_json::json!({
                    "value": json_value,
                    "scope": scope_str
                });

                serde_json::to_string(&result_obj)
                    .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
            }
            None => Err(JsValue::from_str(&format!(
                "Property '{}' not found in any scope",
                property
            ))),
        }
    }

    /// Get all edges in the network
    /// Returns JSON string array of edges
    #[wasm_bindgen]
    pub fn get_edges(
        &self,
        network_path: &str,
        source: Option<String>,
        target: Option<String>,
    ) -> Result<String, JsValue> {
        let (network, _validation) = parser::load_network_from_directory(network_path)
            .map_err(|e| JsValue::from_str(&format!("Failed to load network: {}", e)))?;

        let edges: Vec<_> = network
            .edges
            .iter()
            .filter(|e| {
                if let Some(ref filter_source) = source {
                    if e.source != *filter_source {
                        return false;
                    }
                }
                if let Some(ref filter_target) = target {
                    if e.target != *filter_target {
                        return false;
                    }
                }
                true
            })
            .collect();

        let json = serde_json::to_string(&edges)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize edges: {}", e)))?;

        Ok(json)
    }

    /// Get available schema versions
    /// Returns JSON array of version strings
    #[wasm_bindgen]
    pub fn get_schema_versions(&self, schemas_dir: &str) -> Result<String, JsValue> {
        // Scan for version directories
        let schemas_path = std::path::Path::new(schemas_dir);
        let mut versions = Vec::new();

        if schemas_path.exists() {
            let entries = std::fs::read_dir(schemas_path).map_err(|e| {
                JsValue::from_str(&format!("Failed to read schemas directory: {}", e))
            })?;

            for entry in entries {
                let entry = entry.map_err(|e| {
                    JsValue::from_str(&format!("Failed to read directory entry: {}", e))
                })?;
                let path = entry.path();

                if path.is_dir() {
                    if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                        versions.push(dir_name.to_string());
                    }
                }
            }
        }

        let json = serde_json::to_string(&versions)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize versions: {}", e)))?;

        Ok(json)
    }

    /// Get schemas for a specific version
    /// Returns JSON object mapping block types to schema definitions
    #[wasm_bindgen]
    pub fn get_schemas(&self, schemas_dir: &str, version: &str) -> Result<String, JsValue> {
        let mut registry =
            schema::registry::SchemaRegistry::new(std::path::PathBuf::from(schemas_dir));

        registry
            .load_library(version)
            .map_err(|e| JsValue::from_str(&format!("Failed to load schema library: {}", e)))?;

        let block_types = registry.list_block_types(version);
        let mut schemas = std::collections::HashMap::new();

        for block_type in block_types {
            if let Some(schema) = registry.get_schema(version, block_type) {
                schemas.insert(
                    block_type.clone(),
                    serde_json::json!({
                        "block_type": schema.block_type,
                        "version": schema.version,
                        "required_properties": schema.required_properties,
                        "optional_properties": schema.optional_properties,
                    }),
                );
            }
        }

        let json = serde_json::to_string(&schemas)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize schemas: {}", e)))?;

        Ok(json)
    }

    // Schema validation functions removed - validation now handled in TypeScript with Effect Schema
    // Removed: get_network_schemas, get_block_schema_properties, validate_block,
    // validate_query_blocks, validate_network_blocks
}
