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

    /// Get schema properties for all blocks in a network
    /// files_json: JSON string mapping filename -> content
    /// schema_files_json: JSON string mapping schema filename -> content
    /// Returns JSON object with flattened paths like "branch-1/blocks/0/length" -> property info
    #[wasm_bindgen]
    pub fn get_network_schemas(
        &self,
        files_json: &str,
        config_content: Option<String>,
        schema_files_json: &str,
        version: &str,
    ) -> Result<String, JsValue> {
        // Parse the JSON string into a HashMap
        let files: std::collections::HashMap<String, String> = serde_json::from_str(files_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse files JSON: {}", e)))?;

        // Load network
        let (network, _validation) = parser::load_network_from_files(files, config_content)
            .map_err(|e| JsValue::from_str(&format!("Failed to load network: {}", e)))?;

        // Load schema library from file contents
        let schema_files: std::collections::HashMap<String, String> =
            serde_json::from_str(schema_files_json).map_err(|e| {
                JsValue::from_str(&format!("Failed to parse schema files JSON: {}", e))
            })?;

        let mut registry = schema::registry::SchemaRegistry::new(std::path::PathBuf::from("")); // Path not used when loading from files

        registry
            .load_library_from_files(version, schema_files)
            .map_err(|e| JsValue::from_str(&format!("Failed to load schema library: {}", e)))?;

        // Build flattened schema properties for all blocks in all branches
        let mut properties = std::collections::HashMap::new();

        // Helper function to process a block and add its schema properties
        fn process_block(
            block_value: &serde_json::Value,
            branch_id: &str,
            block_index: usize,
            registry: &schema::registry::SchemaRegistry,
            version: &str,
            properties: &mut std::collections::HashMap<String, serde_json::Value>,
        ) {
            if let Some(block_type) = block_value.get("type").and_then(|v| v.as_str()) {
                if let Some(schema) = registry.get_schema(version, block_type) {
                    // Add required properties
                    for prop in &schema.required_properties {
                        let path = format!("{}/blocks/{}/{}", branch_id, block_index, prop);
                        let prop_meta = schema.properties.get(prop);
                        let mut prop_json = serde_json::json!({
                            "block_type": block_type,
                            "property": prop,
                            "required": true,
                        });
                        if let Some(meta) = prop_meta {
                            if let Some(title) = &meta.title {
                                prop_json["title"] = serde_json::json!(title);
                            }
                            if let Some(dimension) = &meta.dimension {
                                prop_json["dimension"] = serde_json::json!(dimension);
                            }
                            if let Some(default_unit) = &meta.default_unit {
                                prop_json["defaultUnit"] = serde_json::json!(default_unit);
                            }
                            if let Some(min) = meta.min {
                                prop_json["min"] = serde_json::json!(min);
                            }
                            if let Some(max) = meta.max {
                                prop_json["max"] = serde_json::json!(max);
                            }
                        }
                        properties.insert(path, prop_json);
                    }

                    // Add optional properties
                    for prop in &schema.optional_properties {
                        let path = format!("{}/blocks/{}/{}", branch_id, block_index, prop);
                        let prop_meta = schema.properties.get(prop);
                        let mut prop_json = serde_json::json!({
                            "block_type": block_type,
                            "property": prop,
                            "required": false,
                        });
                        if let Some(meta) = prop_meta {
                            if let Some(title) = &meta.title {
                                prop_json["title"] = serde_json::json!(title);
                            }
                            if let Some(dimension) = &meta.dimension {
                                prop_json["dimension"] = serde_json::json!(dimension);
                            }
                            if let Some(default_unit) = &meta.default_unit {
                                prop_json["defaultUnit"] = serde_json::json!(default_unit);
                            }
                            if let Some(min) = meta.min {
                                prop_json["min"] = serde_json::json!(min);
                            }
                            if let Some(max) = meta.max {
                                prop_json["max"] = serde_json::json!(max);
                            }
                        }
                        properties.insert(path, prop_json);
                    }
                }
            }
        }

        // Iterate through all branch nodes and their blocks
        let executor = query::executor::QueryExecutor::new(&network);
        for node in &network.nodes {
            if let parser::models::NodeData::Branch(branch) = node {
                let branch_id = &branch.base.id;

                // Query blocks for this branch
                let query_path = query::parser::QueryPath::Property(
                    "blocks".to_string(),
                    Box::new(query::parser::QueryPath::Node(branch_id.clone())),
                );

                if let Ok(blocks_value) = executor.execute(&query_path) {
                    if let Some(blocks_array) = blocks_value.as_array() {
                        for (block_index, block_value) in blocks_array.iter().enumerate() {
                            process_block(
                                block_value,
                                branch_id,
                                block_index,
                                &registry,
                                version,
                                &mut properties,
                            );
                        }
                    }
                }
            }
        }

        let json = serde_json::to_string(&properties)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize properties: {}", e)))?;

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
                        let prop_meta = schema.properties.get(prop);
                        let mut prop_json = serde_json::json!({
                            "required": true,
                            "block_type": block_type,
                            "property": prop
                        });
                        if let Some(meta) = prop_meta {
                            if let Some(title) = &meta.title {
                                prop_json["title"] = serde_json::json!(title);
                            }
                            if let Some(dimension) = &meta.dimension {
                                prop_json["dimension"] = serde_json::json!(dimension);
                            }
                            if let Some(default_unit) = &meta.default_unit {
                                prop_json["defaultUnit"] = serde_json::json!(default_unit);
                            }
                            if let Some(min) = meta.min {
                                prop_json["min"] = serde_json::json!(min);
                            }
                            if let Some(max) = meta.max {
                                prop_json["max"] = serde_json::json!(max);
                            }
                        }
                        properties.insert(full_path, prop_json);
                    }
                    // Add optional properties
                    for prop in &schema.optional_properties {
                        let full_path = format!("{}/{}", base_path, prop);
                        let prop_meta = schema.properties.get(prop);
                        let mut prop_json = serde_json::json!({
                            "required": false,
                            "block_type": block_type,
                            "property": prop
                        });
                        if let Some(meta) = prop_meta {
                            if let Some(title) = &meta.title {
                                prop_json["title"] = serde_json::json!(title);
                            }
                            if let Some(dimension) = &meta.dimension {
                                prop_json["dimension"] = serde_json::json!(dimension);
                            }
                            if let Some(default_unit) = &meta.default_unit {
                                prop_json["defaultUnit"] = serde_json::json!(default_unit);
                            }
                            if let Some(min) = meta.min {
                                prop_json["min"] = serde_json::json!(min);
                            }
                            if let Some(max) = meta.max {
                                prop_json["max"] = serde_json::json!(max);
                            }
                        }
                        properties.insert(full_path, prop_json);
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

        serde_json::to_string(&json).map_err(|e| {
            JsValue::from_str(&format!("Failed to serialize validation result: {}", e))
        })
    }

    /// Validate blocks matching a query path and return both properties and validation results
    /// files_json: JSON string mapping filename -> content (network files)
    /// schema_files_json: JSON string mapping filename -> content (schema files)
    /// query_str: Query path (e.g., "branch-4/data/blocks/2" or "branch-4/data/blocks")
    /// Returns JSON object with properties and validation results for each block
    #[wasm_bindgen]
    pub fn validate_query_blocks(
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

        // Parse query path and extract unit overrides (scope is handled by executor)
        let (query_path, _unit_overrides) = query::parser::parse_query_path_with_params(query_str)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse query: {}", e)))?;

        // Load schema library from file contents
        let schema_files: std::collections::HashMap<String, String> =
            serde_json::from_str(schema_files_json).map_err(|e| {
                JsValue::from_str(&format!("Failed to parse schema files JSON: {}", e))
            })?;

        // Clone schema_files since we need it for both registries
        let schema_files_clone = schema_files.clone();

        let mut registry = schema::registry::SchemaRegistry::new(std::path::PathBuf::from("")); // Path not used when loading from files

        registry
            .load_library_from_files(version, schema_files)
            .map_err(|e| JsValue::from_str(&format!("Failed to load schema library: {}", e)))?;

        // Load config for scope resolution
        let config = if let Some(config_content) = config_content {
            scope::config::Config::load_from_str(&config_content)
                .map_err(|e| JsValue::from_str(&format!("Failed to load config: {}", e)))?
        } else {
            scope::config::Config::empty()
        };
        let resolver = scope::resolver::ScopeResolver::new(config);

        // Execute query to get blocks
        let executor = query::executor::QueryExecutor::with_scope_resolver(&network, &resolver);
        let query_result = executor
            .execute(&query_path)
            .map_err(|e| JsValue::from_str(&format!("Query error: {}", e)))?;

        // Create a separate registry for the validator (since validator takes ownership)
        let mut validator_registry =
            schema::registry::SchemaRegistry::new(std::path::PathBuf::from(""));
        validator_registry
            .load_library_from_files(version, schema_files_clone)
            .map_err(|e| {
                JsValue::from_str(&format!(
                    "Failed to load schema library for validator: {}",
                    e
                ))
            })?;
        let validator = schema::validator::SchemaValidator::new(validator_registry);

        // Build result with validation results per property
        let mut result = std::collections::HashMap::new();

        // Helper function to validate a block and return per-property validation results
        #[allow(clippy::too_many_arguments)]
        fn validate_block_properties(
            block_value: &serde_json::Value,
            block_path: &str,
            schema: &schema::registry::SchemaDefinition,
            block_type: &str,
            _validator: &schema::validator::SchemaValidator,
            _version: &str,
            resolver: &scope::resolver::ScopeResolver,
            network: &parser::models::Network,
            result: &mut std::collections::HashMap<String, serde_json::Value>,
        ) {
            if let Ok(block) = serde_json::from_value::<parser::models::Block>(block_value.clone())
            {
                let block_properties: std::collections::HashSet<&String> =
                    block.extra.keys().collect();

                // Find the branch node for this block
                let branch_node = network.nodes.iter().find_map(|n| match n {
                    parser::models::NodeData::Branch(b) => {
                        // Extract branch ID from block_path (e.g., "branch-4/blocks/0" -> "branch-4")
                        let path_parts: Vec<&str> = block_path.split('/').collect();
                        if !path_parts.is_empty() && b.base.id == path_parts[0] {
                            Some(b)
                        } else {
                            None
                        }
                    }
                    _ => None,
                });

                let group = branch_node
                    .and_then(|b| b.base.parent_id.as_ref())
                    .and_then(|parent_id| {
                        network.nodes.iter().find_map(|n| match n {
                            parser::models::NodeData::Group(g) if g.base.id == *parent_id => {
                                Some(g)
                            }
                            _ => None,
                        })
                    });

                // Helper to convert TOML Value to JSON Value
                fn toml_to_json(value: &toml::Value) -> serde_json::Value {
                    match value {
                        toml::Value::String(s) => serde_json::Value::String(s.clone()),
                        toml::Value::Integer(i) => serde_json::Value::Number((*i).into()),
                        toml::Value::Float(f) => {
                            // Convert float to JSON number
                            use serde_json::Number;
                            if let Some(n) = Number::from_f64(*f) {
                                serde_json::Value::Number(n)
                            } else {
                                serde_json::Value::Number(Number::from(0))
                            }
                        }
                        toml::Value::Boolean(b) => serde_json::Value::Bool(*b),
                        toml::Value::Array(arr) => {
                            serde_json::Value::Array(arr.iter().map(toml_to_json).collect())
                        }
                        toml::Value::Table(table) => {
                            let mut map = serde_json::Map::new();
                            for (k, v) in table {
                                map.insert(k.clone(), toml_to_json(v));
                            }
                            serde_json::Value::Object(map)
                        }
                        toml::Value::Datetime(_) => serde_json::Value::String(value.to_string()),
                    }
                }

                // Helper to extract numeric value from TOML Value (handles unit strings like "100 m")
                fn extract_numeric_value(value: &toml::Value) -> Option<f64> {
                    match value {
                        toml::Value::Integer(i) => Some(*i as f64),
                        toml::Value::Float(f) => Some(*f),
                        toml::Value::String(s) => {
                            // Try to parse unit string (e.g., "100 m" -> 100.0)
                            // Simple parsing: number followed by optional unit
                            if let Some(num_str) = s.split_whitespace().next() {
                                num_str.parse::<f64>().ok()
                            } else {
                                None
                            }
                        }
                        _ => None,
                    }
                }

                // Helper to validate value against constraints
                fn validate_constraints(
                    value: &toml::Value,
                    prop_meta: &schema::registry::PropertyMetadata,
                ) -> Option<(bool, String)> {
                    let mut is_valid = true;
                    let mut message = String::new();

                    // If defaultUnit is present, we need to convert the value to that unit
                    if let Some(ref default_unit) = prop_meta.default_unit {
                        // Try to use dim for unit conversion (only available in native builds)
                        #[cfg(not(target_arch = "wasm32"))]
                        {
                            if let Some(value_str) = value.as_str() {
                                // Try to parse as unit string and convert to defaultUnit
                                if let Ok(mut parser) = crate::dim::DimParser::new() {
                                    // Convert value to defaultUnit: "value_str as default_unit"
                                    let conversion_expr =
                                        format!("{} as {}", value_str, default_unit);
                                    if let Ok(result) = parser.parse_unit_string(&conversion_expr) {
                                        let converted_value = result.value;

                                        if let Some(min) = prop_meta.min {
                                            if converted_value < min {
                                                is_valid = false;
                                                message = format!(
                                                    "Value {} {} is less than minimum {} {}",
                                                    converted_value,
                                                    default_unit,
                                                    min,
                                                    default_unit
                                                );
                                            }
                                        }

                                        if let Some(max) = prop_meta.max {
                                            if converted_value > max {
                                                is_valid = false;
                                                if !message.is_empty() {
                                                    message.push_str("; ");
                                                }
                                                message.push_str(&format!(
                                                    "Value {} {} is greater than maximum {} {}",
                                                    converted_value,
                                                    default_unit,
                                                    max,
                                                    default_unit
                                                ));
                                            }
                                        }

                                        if !is_valid {
                                            return Some((false, message));
                                        } else {
                                            return None; // Valid
                                        }
                                    }
                                }
                            }
                        }

                        // In WASM builds or if dim conversion failed, skip validation
                        // TypeScript will handle it with proper unit conversion
                        #[cfg(target_arch = "wasm32")]
                        {
                            return None;
                        }

                        // If dim conversion failed in native build, fall through to simple numeric comparison
                    }

                    // Simple numeric comparison (no unit conversion needed)
                    let numeric_value = extract_numeric_value(value)?;

                    if let Some(min) = prop_meta.min {
                        if numeric_value < min {
                            is_valid = false;
                            message =
                                format!("Value {} is less than minimum {}", numeric_value, min);
                        }
                    }

                    if let Some(max) = prop_meta.max {
                        if numeric_value > max {
                            is_valid = false;
                            if !message.is_empty() {
                                message.push_str("; ");
                            }
                            message.push_str(&format!(
                                "Value {} is greater than maximum {}",
                                numeric_value, max
                            ));
                        }
                    }

                    if !is_valid {
                        Some((false, message))
                    } else {
                        None
                    }
                }

                // Check all required properties
                for prop in &schema.required_properties {
                    let full_path = format!("{}/{}", block_path, prop);
                    let mut prop_result = serde_json::Map::new();
                    let prop_meta = schema.properties.get(prop);

                    // Check if property exists in block
                    if block_properties.contains(prop) {
                        // Property exists in block - check constraints
                        if let Some(value) = block.extra.get(prop) {
                            prop_result.insert("value".to_string(), toml_to_json(value));
                            prop_result.insert("scope".to_string(), serde_json::json!("block"));

                            // Validate constraints if metadata exists
                            if let Some(meta) = prop_meta {
                                if let Some((is_valid_constraint, constraint_msg)) =
                                    validate_constraints(value, meta)
                                {
                                    prop_result.insert(
                                        "is_valid".to_string(),
                                        serde_json::json!(is_valid_constraint),
                                    );
                                    prop_result
                                        .insert("severity".to_string(), serde_json::json!("error"));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!(constraint_msg),
                                    );
                                } else {
                                    prop_result
                                        .insert("is_valid".to_string(), serde_json::json!(true));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!("Value found in block scope"),
                                    );
                                }
                            } else {
                                prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                                prop_result.insert(
                                    "message".to_string(),
                                    serde_json::json!("Value found in block scope"),
                                );
                            }
                        } else {
                            prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                        }
                    } else if let Some(branch) = branch_node {
                        // Try scope resolution
                        if let Some((value, scope_level)) =
                            resolver.resolve_property_with_scope(prop, &block, branch, group)
                        {
                            prop_result.insert("value".to_string(), toml_to_json(&value));
                            let scope_str = match scope_level {
                                scope::config::ScopeLevel::Block => "block",
                                scope::config::ScopeLevel::Branch => "branch",
                                scope::config::ScopeLevel::Group => "group",
                                scope::config::ScopeLevel::Global => "global",
                            };
                            prop_result.insert("scope".to_string(), serde_json::json!(scope_str));

                            // Validate constraints if metadata exists
                            if let Some(meta) = prop_meta {
                                if let Some((is_valid_constraint, constraint_msg)) =
                                    validate_constraints(&value, meta)
                                {
                                    prop_result.insert(
                                        "is_valid".to_string(),
                                        serde_json::json!(is_valid_constraint),
                                    );
                                    prop_result
                                        .insert("severity".to_string(), serde_json::json!("error"));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!(constraint_msg),
                                    );
                                } else {
                                    prop_result
                                        .insert("is_valid".to_string(), serde_json::json!(true));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!(format!(
                                            "Value found in {} scope",
                                            scope_str
                                        )),
                                    );
                                }
                            } else {
                                prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                                prop_result.insert(
                                    "message".to_string(),
                                    serde_json::json!(format!(
                                        "Value found in {} scope",
                                        scope_str
                                    )),
                                );
                            }
                        } else {
                            // Required property missing - error
                            prop_result.insert("is_valid".to_string(), serde_json::json!(false));
                            prop_result.insert("severity".to_string(), serde_json::json!("error"));
                            prop_result.insert(
                                "message".to_string(),
                                serde_json::json!(format!(
                                    "Required property '{}' is missing for block type '{}'",
                                    prop, block_type
                                )),
                            );
                        }
                    } else {
                        // No branch node found - error
                        prop_result.insert("is_valid".to_string(), serde_json::json!(false));
                        prop_result.insert("severity".to_string(), serde_json::json!("error"));
                        prop_result.insert(
                            "message".to_string(),
                            serde_json::json!(format!(
                                "Required property '{}' is missing for block type '{}'",
                                prop, block_type
                            )),
                        );
                    }
                    result.insert(full_path, serde_json::Value::Object(prop_result));
                }

                // Check all optional properties
                for prop in &schema.optional_properties {
                    let full_path = format!("{}/{}", block_path, prop);
                    let mut prop_result = serde_json::Map::new();

                    // Check if property exists in block
                    if block_properties.contains(prop) {
                        // Property exists - valid
                        prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                        if let Some(value) = block.extra.get(prop) {
                            prop_result.insert("value".to_string(), toml_to_json(value));
                            prop_result.insert("scope".to_string(), serde_json::json!("block"));
                            prop_result.insert(
                                "message".to_string(),
                                serde_json::json!("Value found in block scope"),
                            );
                        }
                    } else if let Some(branch) = branch_node {
                        // Try scope resolution
                        if let Some((value, scope_level)) =
                            resolver.resolve_property_with_scope(prop, &block, branch, group)
                        {
                            prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                            prop_result.insert("value".to_string(), toml_to_json(&value));
                            let scope_str = match scope_level {
                                scope::config::ScopeLevel::Block => "block",
                                scope::config::ScopeLevel::Branch => "branch",
                                scope::config::ScopeLevel::Group => "group",
                                scope::config::ScopeLevel::Global => "global",
                            };
                            prop_result.insert("scope".to_string(), serde_json::json!(scope_str));
                            prop_result.insert(
                                "message".to_string(),
                                serde_json::json!(format!("Value found in {} scope", scope_str)),
                            );
                        } else {
                            // Optional property not present - valid (optional)
                            prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                        }
                    } else {
                        // Optional property not present - valid (optional)
                        prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                    }
                    result.insert(full_path, serde_json::Value::Object(prop_result));
                }

                // Don't check for unknown properties - they're not a problem
            }
        }

        // Process query result
        match query_result {
            serde_json::Value::Array(blocks) => {
                // Multiple blocks - need to determine path for each
                let base_query = query_str.split('?').next().unwrap_or(query_str);

                for (idx, block_value) in blocks.iter().enumerate() {
                    let block_path = if base_query.ends_with("/blocks") {
                        format!("{}/{}", base_query, idx)
                    } else if base_query.contains("/blocks/") {
                        base_query.to_string()
                    } else {
                        format!("{}/{}", base_query, idx)
                    };

                    if let Some(block_type) = block_value.get("type").and_then(|v| v.as_str()) {
                        if let Some(schema) = registry.get_schema(version, block_type) {
                            validate_block_properties(
                                block_value,
                                &block_path,
                                schema,
                                block_type,
                                &validator,
                                version,
                                &resolver,
                                &network,
                                &mut result,
                            );
                        }
                    }
                }
            }
            block_value => {
                // Single block - use query path as base
                let base_query = query_str.split('?').next().unwrap_or(query_str);

                if let Some(block_type) = block_value.get("type").and_then(|v| v.as_str()) {
                    if let Some(schema) = registry.get_schema(version, block_type) {
                        validate_block_properties(
                            &block_value,
                            base_query,
                            schema,
                            block_type,
                            &validator,
                            version,
                            &resolver,
                            &network,
                            &mut result,
                        );
                    }
                }
            }
        }

        let json = serde_json::to_string(&result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))?;

        Ok(json)
    }

    /// Validate all blocks in a network and return both properties and validation results
    /// files_json: JSON string mapping filename -> content (network files)
    /// schema_files_json: JSON string mapping filename -> content (schema files)
    /// Returns JSON object with flattened paths like "branch-1/blocks/0/length" -> property info and validation
    #[wasm_bindgen]
    pub fn validate_network_blocks(
        &self,
        files_json: &str,
        config_content: Option<String>,
        schema_files_json: &str,
        version: &str,
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

        // Load schema library from file contents
        let schema_files: std::collections::HashMap<String, String> =
            serde_json::from_str(schema_files_json).map_err(|e| {
                JsValue::from_str(&format!("Failed to parse schema files JSON: {}", e))
            })?;

        // Clone schema_files since we need it for both registries
        let schema_files_clone = schema_files.clone();

        let mut registry = schema::registry::SchemaRegistry::new(std::path::PathBuf::from("")); // Path not used when loading from files

        registry
            .load_library_from_files(version, schema_files)
            .map_err(|e| JsValue::from_str(&format!("Failed to load schema library: {}", e)))?;

        // Create a separate registry for the validator (since validator takes ownership)
        let mut validator_registry =
            schema::registry::SchemaRegistry::new(std::path::PathBuf::from(""));
        validator_registry
            .load_library_from_files(version, schema_files_clone)
            .map_err(|e| {
                JsValue::from_str(&format!(
                    "Failed to load schema library for validator: {}",
                    e
                ))
            })?;
        let validator = schema::validator::SchemaValidator::new(validator_registry);

        // Build result with validation results per property
        let mut result = std::collections::HashMap::new();

        // Helper function to validate a block and return per-property validation results
        // This is a duplicate of the logic in validate_query_blocks since we can't share nested functions
        #[allow(clippy::too_many_arguments)]
        fn validate_block_properties_network(
            block_value: &serde_json::Value,
            block_path: &str,
            schema: &schema::registry::SchemaDefinition,
            block_type: &str,
            _validator: &schema::validator::SchemaValidator,
            _version: &str,
            resolver: &scope::resolver::ScopeResolver,
            network: &parser::models::Network,
            result: &mut std::collections::HashMap<String, serde_json::Value>,
        ) {
            if let Ok(block) = serde_json::from_value::<parser::models::Block>(block_value.clone())
            {
                let block_properties: std::collections::HashSet<&String> =
                    block.extra.keys().collect();

                // Find the branch node for this block
                let branch_node = network.nodes.iter().find_map(|n| match n {
                    parser::models::NodeData::Branch(b) => {
                        // Extract branch ID from block_path (e.g., "branch-4/blocks/0" -> "branch-4")
                        let path_parts: Vec<&str> = block_path.split('/').collect();
                        if !path_parts.is_empty() && b.base.id == path_parts[0] {
                            Some(b)
                        } else {
                            None
                        }
                    }
                    _ => None,
                });

                let group = branch_node
                    .and_then(|b| b.base.parent_id.as_ref())
                    .and_then(|parent_id| {
                        network.nodes.iter().find_map(|n| match n {
                            parser::models::NodeData::Group(g) if g.base.id == *parent_id => {
                                Some(g)
                            }
                            _ => None,
                        })
                    });

                // Helper to convert TOML Value to JSON Value
                fn toml_to_json(value: &toml::Value) -> serde_json::Value {
                    match value {
                        toml::Value::String(s) => serde_json::Value::String(s.clone()),
                        toml::Value::Integer(i) => serde_json::Value::Number((*i).into()),
                        toml::Value::Float(f) => {
                            // Convert float to JSON number
                            use serde_json::Number;
                            if let Some(n) = Number::from_f64(*f) {
                                serde_json::Value::Number(n)
                            } else {
                                serde_json::Value::Number(Number::from(0))
                            }
                        }
                        toml::Value::Boolean(b) => serde_json::Value::Bool(*b),
                        toml::Value::Array(arr) => {
                            serde_json::Value::Array(arr.iter().map(toml_to_json).collect())
                        }
                        toml::Value::Table(table) => {
                            let mut map = serde_json::Map::new();
                            for (k, v) in table {
                                map.insert(k.clone(), toml_to_json(v));
                            }
                            serde_json::Value::Object(map)
                        }
                        toml::Value::Datetime(_) => serde_json::Value::String(value.to_string()),
                    }
                }

                // Helper to extract numeric value from TOML Value (handles unit strings like "100 m")
                fn extract_numeric_value(value: &toml::Value) -> Option<f64> {
                    match value {
                        toml::Value::Integer(i) => Some(*i as f64),
                        toml::Value::Float(f) => Some(*f),
                        toml::Value::String(s) => {
                            // Try to parse unit string (e.g., "100 m" -> 100.0)
                            // Simple parsing: number followed by optional unit
                            if let Some(num_str) = s.split_whitespace().next() {
                                num_str.parse::<f64>().ok()
                            } else {
                                None
                            }
                        }
                        _ => None,
                    }
                }

                // Helper to validate value against constraints
                fn validate_constraints(
                    value: &toml::Value,
                    prop_meta: &schema::registry::PropertyMetadata,
                ) -> Option<(bool, String)> {
                    let mut is_valid = true;
                    let mut message = String::new();

                    // If defaultUnit is present, we need to convert the value to that unit
                    if let Some(ref default_unit) = prop_meta.default_unit {
                        // Try to use dim for unit conversion (only available in native builds)
                        #[cfg(not(target_arch = "wasm32"))]
                        {
                            if let Some(value_str) = value.as_str() {
                                // Try to parse as unit string and convert to defaultUnit
                                if let Ok(mut parser) = crate::dim::DimParser::new() {
                                    // Convert value to defaultUnit: "value_str as default_unit"
                                    let conversion_expr =
                                        format!("{} as {}", value_str, default_unit);
                                    if let Ok(result) = parser.parse_unit_string(&conversion_expr) {
                                        let converted_value = result.value;

                                        if let Some(min) = prop_meta.min {
                                            if converted_value < min {
                                                is_valid = false;
                                                message = format!(
                                                    "Value {} {} is less than minimum {} {}",
                                                    converted_value,
                                                    default_unit,
                                                    min,
                                                    default_unit
                                                );
                                            }
                                        }

                                        if let Some(max) = prop_meta.max {
                                            if converted_value > max {
                                                is_valid = false;
                                                if !message.is_empty() {
                                                    message.push_str("; ");
                                                }
                                                message.push_str(&format!(
                                                    "Value {} {} is greater than maximum {} {}",
                                                    converted_value,
                                                    default_unit,
                                                    max,
                                                    default_unit
                                                ));
                                            }
                                        }

                                        if !is_valid {
                                            return Some((false, message));
                                        } else {
                                            return None; // Valid
                                        }
                                    }
                                }
                            }
                        }

                        // In WASM builds or if dim conversion failed, skip validation
                        // TypeScript will handle it with proper unit conversion
                        #[cfg(target_arch = "wasm32")]
                        {
                            return None;
                        }

                        // If dim conversion failed in native build, fall through to simple numeric comparison
                    }

                    // Simple numeric comparison (no unit conversion needed)
                    let numeric_value = extract_numeric_value(value)?;

                    if let Some(min) = prop_meta.min {
                        if numeric_value < min {
                            is_valid = false;
                            message =
                                format!("Value {} is less than minimum {}", numeric_value, min);
                        }
                    }

                    if let Some(max) = prop_meta.max {
                        if numeric_value > max {
                            is_valid = false;
                            if !message.is_empty() {
                                message.push_str("; ");
                            }
                            message.push_str(&format!(
                                "Value {} is greater than maximum {}",
                                numeric_value, max
                            ));
                        }
                    }

                    if !is_valid {
                        Some((false, message))
                    } else {
                        None
                    }
                }

                // Check all required properties
                for prop in &schema.required_properties {
                    let full_path = format!("{}/{}", block_path, prop);
                    let mut prop_result = serde_json::Map::new();
                    let prop_meta = schema.properties.get(prop);

                    // Check if property exists in block
                    if block_properties.contains(prop) {
                        // Property exists in block - check constraints
                        if let Some(value) = block.extra.get(prop) {
                            prop_result.insert("value".to_string(), toml_to_json(value));
                            prop_result.insert("scope".to_string(), serde_json::json!("block"));

                            // Validate constraints if metadata exists
                            if let Some(meta) = prop_meta {
                                if let Some((is_valid_constraint, constraint_msg)) =
                                    validate_constraints(value, meta)
                                {
                                    prop_result.insert(
                                        "is_valid".to_string(),
                                        serde_json::json!(is_valid_constraint),
                                    );
                                    prop_result
                                        .insert("severity".to_string(), serde_json::json!("error"));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!(constraint_msg),
                                    );
                                } else {
                                    prop_result
                                        .insert("is_valid".to_string(), serde_json::json!(true));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!("Value found in block scope"),
                                    );
                                }
                            } else {
                                prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                                prop_result.insert(
                                    "message".to_string(),
                                    serde_json::json!("Value found in block scope"),
                                );
                            }
                        } else {
                            prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                        }
                    } else if let Some(branch) = branch_node {
                        // Try scope resolution
                        if let Some((value, scope_level)) =
                            resolver.resolve_property_with_scope(prop, &block, branch, group)
                        {
                            prop_result.insert("value".to_string(), toml_to_json(&value));
                            let scope_str = match scope_level {
                                scope::config::ScopeLevel::Block => "block",
                                scope::config::ScopeLevel::Branch => "branch",
                                scope::config::ScopeLevel::Group => "group",
                                scope::config::ScopeLevel::Global => "global",
                            };
                            prop_result.insert("scope".to_string(), serde_json::json!(scope_str));

                            // Validate constraints if metadata exists
                            if let Some(meta) = prop_meta {
                                if let Some((is_valid_constraint, constraint_msg)) =
                                    validate_constraints(&value, meta)
                                {
                                    prop_result.insert(
                                        "is_valid".to_string(),
                                        serde_json::json!(is_valid_constraint),
                                    );
                                    prop_result
                                        .insert("severity".to_string(), serde_json::json!("error"));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!(constraint_msg),
                                    );
                                } else {
                                    prop_result
                                        .insert("is_valid".to_string(), serde_json::json!(true));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!(format!(
                                            "Value found in {} scope",
                                            scope_str
                                        )),
                                    );
                                }
                            } else {
                                prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                                prop_result.insert(
                                    "message".to_string(),
                                    serde_json::json!(format!(
                                        "Value found in {} scope",
                                        scope_str
                                    )),
                                );
                            }
                        } else {
                            // Required property missing - error
                            prop_result.insert("is_valid".to_string(), serde_json::json!(false));
                            prop_result.insert("severity".to_string(), serde_json::json!("error"));
                            prop_result.insert(
                                "message".to_string(),
                                serde_json::json!(format!(
                                    "Required property '{}' is missing for block type '{}'",
                                    prop, block_type
                                )),
                            );
                        }
                    } else {
                        // No branch node found - error
                        prop_result.insert("is_valid".to_string(), serde_json::json!(false));
                        prop_result.insert("severity".to_string(), serde_json::json!("error"));
                        prop_result.insert(
                            "message".to_string(),
                            serde_json::json!(format!(
                                "Required property '{}' is missing for block type '{}'",
                                prop, block_type
                            )),
                        );
                    }
                    result.insert(full_path, serde_json::Value::Object(prop_result));
                }

                // Check all optional properties
                for prop in &schema.optional_properties {
                    let full_path = format!("{}/{}", block_path, prop);
                    let mut prop_result = serde_json::Map::new();
                    let prop_meta = schema.properties.get(prop);

                    // Check if property exists in block
                    if block_properties.contains(prop) {
                        // Property exists - check constraints
                        if let Some(value) = block.extra.get(prop) {
                            prop_result.insert("value".to_string(), toml_to_json(value));
                            prop_result.insert("scope".to_string(), serde_json::json!("block"));

                            // Validate constraints if metadata exists
                            if let Some(meta) = prop_meta {
                                if let Some((is_valid_constraint, constraint_msg)) =
                                    validate_constraints(value, meta)
                                {
                                    prop_result.insert(
                                        "is_valid".to_string(),
                                        serde_json::json!(is_valid_constraint),
                                    );
                                    prop_result
                                        .insert("severity".to_string(), serde_json::json!("error"));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!(constraint_msg),
                                    );
                                } else {
                                    prop_result
                                        .insert("is_valid".to_string(), serde_json::json!(true));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!("Value found in block scope"),
                                    );
                                }
                            } else {
                                prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                                prop_result.insert(
                                    "message".to_string(),
                                    serde_json::json!("Value found in block scope"),
                                );
                            }
                        } else {
                            prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                        }
                    } else if let Some(branch) = branch_node {
                        // Try scope resolution
                        if let Some((value, scope_level)) =
                            resolver.resolve_property_with_scope(prop, &block, branch, group)
                        {
                            prop_result.insert("value".to_string(), toml_to_json(&value));
                            let scope_str = match scope_level {
                                scope::config::ScopeLevel::Block => "block",
                                scope::config::ScopeLevel::Branch => "branch",
                                scope::config::ScopeLevel::Group => "group",
                                scope::config::ScopeLevel::Global => "global",
                            };
                            prop_result.insert("scope".to_string(), serde_json::json!(scope_str));

                            // Validate constraints if metadata exists
                            if let Some(meta) = prop_meta {
                                if let Some((is_valid_constraint, constraint_msg)) =
                                    validate_constraints(&value, meta)
                                {
                                    prop_result.insert(
                                        "is_valid".to_string(),
                                        serde_json::json!(is_valid_constraint),
                                    );
                                    prop_result
                                        .insert("severity".to_string(), serde_json::json!("error"));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!(constraint_msg),
                                    );
                                } else {
                                    prop_result
                                        .insert("is_valid".to_string(), serde_json::json!(true));
                                    prop_result.insert(
                                        "message".to_string(),
                                        serde_json::json!(format!(
                                            "Value found in {} scope",
                                            scope_str
                                        )),
                                    );
                                }
                            } else {
                                prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                                prop_result.insert(
                                    "message".to_string(),
                                    serde_json::json!(format!(
                                        "Value found in {} scope",
                                        scope_str
                                    )),
                                );
                            }
                        } else {
                            // Optional property not present - valid (optional)
                            prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                        }
                    } else {
                        // Optional property not present - valid (optional)
                        prop_result.insert("is_valid".to_string(), serde_json::json!(true));
                    }
                    result.insert(full_path, serde_json::Value::Object(prop_result));
                }

                // Don't check for unknown properties - they're not a problem
            }
        }

        // Iterate through all branch nodes and their blocks
        let executor = query::executor::QueryExecutor::new(&network);
        for node in &network.nodes {
            if let parser::models::NodeData::Branch(branch) = node {
                let branch_id = &branch.base.id;

                // Query blocks for this branch
                let query_path = query::parser::QueryPath::Property(
                    "blocks".to_string(),
                    Box::new(query::parser::QueryPath::Node(branch_id.clone())),
                );

                if let Ok(blocks_value) = executor.execute(&query_path) {
                    if let Some(blocks_array) = blocks_value.as_array() {
                        for (block_index, block_value) in blocks_array.iter().enumerate() {
                            if let Some(block_type) =
                                block_value.get("type").and_then(|v| v.as_str())
                            {
                                if let Some(schema) = registry.get_schema(version, block_type) {
                                    let block_path =
                                        format!("{}/blocks/{}", branch_id, block_index);
                                    validate_block_properties_network(
                                        block_value,
                                        &block_path,
                                        schema,
                                        block_type,
                                        &validator,
                                        version,
                                        &resolver,
                                        &network,
                                        &mut result,
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        let json = serde_json::to_string(&result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))?;

        Ok(json)
    }
}
