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

        // Parse query
        let query_path = query::parser::parse_query_path(query_str)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse query: {}", e)))?;

        // Load config for scope resolution
        let config = if let Some(config_content) = config_content {
            scope::config::Config::load_from_str(&config_content)
                .map_err(|e| JsValue::from_str(&format!("Failed to load config: {}", e)))?
        } else {
            scope::config::Config::empty()
        };
        let resolver = scope::resolver::ScopeResolver::new(config);

        // Execute query
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
                        parser::models::NodeData::Branch(_) => filter_type == "branchNode",
                        parser::models::NodeData::Group(_) => filter_type == "labeledGroupNode",
                        parser::models::NodeData::GeographicAnchor(_) => {
                            filter_type == "geographicAnchorNode"
                        }
                        parser::models::NodeData::GeographicWindow(_) => {
                            filter_type == "geographicWindowNode"
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

    /// Get schemas for all block types used in a network
    /// files_json: JSON string mapping filename -> content
    /// Returns JSON object mapping block types to schema definitions
    #[wasm_bindgen]
    pub fn get_network_schemas(
        &self,
        files_json: &str,
        config_content: Option<String>,
        schemas_dir: &str,
        version: &str,
    ) -> Result<String, JsValue> {
        // Parse the JSON string into a HashMap
        let files: std::collections::HashMap<String, String> = serde_json::from_str(files_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse files JSON: {}", e)))?;

        // Load network
        let (network, _validation) = parser::load_network_from_files(files, config_content)
            .map_err(|e| JsValue::from_str(&format!("Failed to load network: {}", e)))?;

        // Extract all unique block types from the network
        let mut block_types = std::collections::HashSet::new();
        for node in &network.nodes {
            if let parser::models::NodeData::Branch(branch) = node {
                for block in &branch.blocks {
                    block_types.insert(block.type_.clone());
                }
            }
        }

        // Load schema library
        let mut registry =
            schema::registry::SchemaRegistry::new(std::path::PathBuf::from(schemas_dir));

        registry
            .load_library(version)
            .map_err(|e| JsValue::from_str(&format!("Failed to load schema library: {}", e)))?;

        // Get schemas for block types found in the network
        let mut schemas = std::collections::HashMap::new();
        for block_type in block_types {
            if let Some(schema) = registry.get_schema(version, &block_type) {
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

    /// Get schema properties for blocks matching a query path
    /// files_json: JSON string mapping filename -> content (network files)
    /// schema_files_json: JSON string mapping filename -> content (schema files)
    /// query_str: Query path (e.g., "branch-4/data/blocks/2" or "branch-4/data/blocks")
    /// Returns JSON object with flattened paths like "branch-4/data/blocks/2/length": {"required": true, "type": "number"}
    #[wasm_bindgen]
    pub fn get_block_schema_properties(
        &self,
        files_json: &str,
        config_content: Option<String>,
        query_str: &str,
        schema_files_json: &str,
        version: &str,
    ) -> Result<String, JsValue> {
        // Parse the JSON string into a HashMap
        let files: std::collections::HashMap<String, String> = serde_json::from_str(files_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse files JSON: {}", e)))?;

        // Load network
        let (network, _validation) = parser::load_network_from_files(files, config_content.clone())
            .map_err(|e| JsValue::from_str(&format!("Failed to load network: {}", e)))?;

        // Parse query
        let query_path = query::parser::parse_query_path(query_str)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse query: {}", e)))?;

        // Load schema library from file contents
        let schema_files: std::collections::HashMap<String, String> =
            serde_json::from_str(schema_files_json).map_err(|e| {
                JsValue::from_str(&format!("Failed to parse schema files JSON: {}", e))
            })?;

        let mut registry = schema::registry::SchemaRegistry::new(std::path::PathBuf::from("")); // Path not used when loading from files

        registry
            .load_library_from_files(version, schema_files)
            .map_err(|e| JsValue::from_str(&format!("Failed to load schema library: {}", e)))?;

        // Execute query to get blocks
        let executor = query::executor::QueryExecutor::new(&network);
        let query_result = executor
            .execute(&query_path)
            .map_err(|e| JsValue::from_str(&format!("Query error: {}", e)))?;

        // Build flattened schema properties
        let mut properties = std::collections::HashMap::new();

        // Helper function to process a block and add its schema properties
        fn process_block(
            block_value: &serde_json::Value,
            base_path: &str,
            properties: &mut std::collections::HashMap<String, serde_json::Value>,
            registry: &schema::registry::SchemaRegistry,
            version: &str,
        ) {
            if let Some(block_type) = block_value.get("type").and_then(|v| v.as_str()) {
                if let Some(schema) = registry.get_schema(version, block_type) {
                    // Add required properties
                    for prop in &schema.required_properties {
                        let full_path = format!("{}/{}", base_path, prop);
                        properties.insert(
                            full_path,
                            serde_json::json!({
                                "required": true,
                                "block_type": block_type,
                                "property": prop
                            }),
                        );
                    }
                    // Add optional properties
                    for prop in &schema.optional_properties {
                        let full_path = format!("{}/{}", base_path, prop);
                        properties.insert(
                            full_path,
                            serde_json::json!({
                                "required": false,
                                "block_type": block_type,
                                "property": prop
                            }),
                        );
                    }
                }
            }
        }

        // Process query result
        match query_result {
            serde_json::Value::Array(blocks) => {
                // Multiple blocks - need to determine path for each
                // Try to extract path components from query
                let base_query = query_str.split('?').next().unwrap_or(query_str);

                for (idx, block_value) in blocks.iter().enumerate() {
                    // Build path: if query ends with /blocks, use /blocks/{idx}
                    // Otherwise, try to preserve the query path structure
                    let block_path = if base_query.ends_with("/blocks") {
                        format!("{}/{}", base_query, idx)
                    } else if base_query.contains("/blocks/") {
                        // Already has an index, use as-is
                        base_query.to_string()
                    } else {
                        // Fallback: append index
                        format!("{}/{}", base_query, idx)
                    };
                    process_block(
                        block_value,
                        &block_path,
                        &mut properties,
                        &registry,
                        version,
                    );
                }
            }
            block_value => {
                // Single block - use query path as base
                let base_query = query_str.split('?').next().unwrap_or(query_str);
                process_block(
                    &block_value,
                    base_query,
                    &mut properties,
                    &registry,
                    version,
                );
            }
        }

        let json = serde_json::to_string(&properties)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize properties: {}", e)))?;

        Ok(json)
    }

    /// Validate a block against a schema
    /// Returns JSON object with validation results
    #[wasm_bindgen]
    pub fn validate_block(
        &self,
        schemas_dir: &str,
        version: &str,
        _block_type: &str,
        block_json: &str,
    ) -> Result<String, JsValue> {
        let mut registry =
            schema::registry::SchemaRegistry::new(std::path::PathBuf::from(schemas_dir));

        registry
            .load_library(version)
            .map_err(|e| JsValue::from_str(&format!("Failed to load schema library: {}", e)))?;

        // Parse block JSON and convert to Block
        // We'll use serde_json to deserialize directly since Block implements Deserialize
        let block: parser::models::Block = serde_json::from_str(block_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse block JSON: {}", e)))?;

        // Validate
        let validator = schema::validator::SchemaValidator::new(registry);
        let result = validator.validate_block(&block, version);

        // Convert ValidationResult to JSON
        let issues: Vec<_> = result
            .issues
            .iter()
            .map(|issue| {
                serde_json::json!({
                    "severity": match issue.severity {
                        schema::validator::IssueSeverity::Error => "error",
                        schema::validator::IssueSeverity::Warning => "warning",
                    },
                    "message": issue.message,
                    "property": issue.property,
                })
            })
            .collect();

        let json = serde_json::json!({
            "is_valid": result.is_valid(),
            "has_issues": result.has_issues(),
            "issues": issues,
        });

        Ok(serde_json::to_string(&json).map_err(|e| {
            JsValue::from_str(&format!("Failed to serialize validation result: {}", e))
        })?)
    }
}
