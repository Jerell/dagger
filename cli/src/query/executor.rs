#[cfg(not(target_arch = "wasm32"))]
use crate::dim::formatter::{UnitFormatter, UnitPreferences};
use crate::parser::models::*;
use crate::query::parser::{FilterOperator, ParseError, QueryPath};
#[cfg(not(target_arch = "wasm32"))]
use crate::schema::registry::SchemaRegistry;
use serde_json::Value as JsonValue;
use toml::Value as TomlValue;

#[derive(Debug)]
pub enum QueryError {
    NodeNotFound(String),
    PropertyNotFound(String),
    IndexOutOfRange(usize, usize),
    InvalidType(String),
    ParseError(ParseError),
}

impl std::fmt::Display for QueryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            QueryError::NodeNotFound(id) => write!(f, "Node '{}' not found", id),
            QueryError::PropertyNotFound(prop) => write!(f, "Property '{}' not found", prop),
            QueryError::IndexOutOfRange(idx, len) => {
                write!(f, "Index {} out of range (length: {})", idx, len)
            }
            QueryError::InvalidType(msg) => write!(f, "Invalid type: {}", msg),
            QueryError::ParseError(e) => write!(f, "Parse error: {}", e),
        }
    }
}

impl std::error::Error for QueryError {}

impl From<ParseError> for QueryError {
    fn from(e: ParseError) -> Self {
        QueryError::ParseError(e)
    }
}

pub struct QueryExecutor<'a> {
    network: &'a Network,
    scope_resolver: Option<&'a crate::scope::resolver::ScopeResolver>,
    #[cfg(not(target_arch = "wasm32"))]
    unit_preferences: UnitPreferences,
    #[cfg(not(target_arch = "wasm32"))]
    schema_registry: Option<&'a SchemaRegistry>,
    #[cfg(not(target_arch = "wasm32"))]
    schema_version: Option<&'a str>,
}

// Context tracked during query execution for scope resolution
struct QueryContext {
    node_id: Option<String>,
    block_index: Option<usize>,
}

impl<'a> QueryExecutor<'a> {
    pub fn new(network: &'a Network) -> Self {
        Self {
            network,
            scope_resolver: None,
            #[cfg(not(target_arch = "wasm32"))]
            unit_preferences: UnitPreferences::default(),
            #[cfg(not(target_arch = "wasm32"))]
            schema_registry: None,
            #[cfg(not(target_arch = "wasm32"))]
            schema_version: None,
        }
    }

    pub fn with_scope_resolver(
        network: &'a Network,
        resolver: &'a crate::scope::resolver::ScopeResolver,
    ) -> Self {
        Self {
            network,
            scope_resolver: Some(resolver),
            #[cfg(not(target_arch = "wasm32"))]
            unit_preferences: UnitPreferences::default(),
            #[cfg(not(target_arch = "wasm32"))]
            schema_registry: None,
            #[cfg(not(target_arch = "wasm32"))]
            schema_version: None,
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn with_unit_preferences(
        network: &'a Network,
        resolver: Option<&'a crate::scope::resolver::ScopeResolver>,
        unit_preferences: UnitPreferences,
        schema_registry: Option<&'a SchemaRegistry>,
        schema_version: Option<&'a str>,
    ) -> Self {
        Self {
            network,
            scope_resolver: resolver,
            unit_preferences,
            schema_registry,
            schema_version,
        }
    }

    pub fn execute(&self, path: &QueryPath) -> Result<JsonValue, QueryError> {
        // Check if this is a network-level query
        if let QueryPath::Property(name, inner) = path {
            if let QueryPath::Node(id) = inner.as_ref() {
                if id == "network" {
                    return self.execute_network_query(name);
                }
            }
        }

        self.execute_with_context(
            path,
            &mut QueryContext {
                node_id: None,
                block_index: None,
            },
        )
    }

    fn execute_network_query(&self, collection: &str) -> Result<JsonValue, QueryError> {
        match collection {
            "nodes" => {
                let nodes: Vec<JsonValue> = self
                    .network
                    .nodes
                    .iter()
                    .map(|n| {
                        let value = serde_json::to_value(n).map_err(|e| {
                            QueryError::InvalidType(format!("Failed to serialize: {}", e))
                        })?;
                        match value {
                            JsonValue::Object(map) => {
                                if let Some((_, node_value)) = map.into_iter().next() {
                                    Ok(node_value)
                                } else {
                                    Err(QueryError::InvalidType("Empty node".to_string()))
                                }
                            }
                            _ => Ok(value),
                        }
                    })
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(JsonValue::Array(nodes))
            }
            "edges" => {
                let edges = serde_json::to_value(&self.network.edges)
                    .map_err(|e| QueryError::InvalidType(format!("Failed to serialize: {}", e)))?;
                Ok(edges)
            }
            _ => Err(QueryError::InvalidType(format!(
                "Unknown network collection: {}",
                collection
            ))),
        }
    }

    fn execute_with_context(
        &self,
        path: &QueryPath,
        context: &mut QueryContext,
    ) -> Result<JsonValue, QueryError> {
        match path {
            QueryPath::Node(id) => {
                context.node_id = Some(id.clone());
                self.get_node(id)
            }
            QueryPath::Property(name, inner) => {
                let value = self.execute_with_context(inner, context)?;
                // If we're accessing a property on a block and it's not found, try scope resolution
                // Check if this looks like a block object (has "type" property)
                let is_block = value
                    .as_object()
                    .and_then(|obj| obj.get("type"))
                    .and_then(|t| t.as_str())
                    .is_some();

                if is_block && context.block_index.is_some() && context.node_id.is_some() {
                    // Check if property exists directly first
                    match self.get_property(&value, name) {
                        Ok(v) => Ok(v),
                        Err(QueryError::PropertyNotFound(_)) => {
                            // Property not found directly, try scope resolution
                            if let Some(resolver) = self.scope_resolver {
                                // Use config's default scope chain (no explicit scopes)
                                self.resolve_scoped_property_from_context(
                                    name,
                                    &[],
                                    context,
                                    resolver,
                                )
                            } else {
                                Err(QueryError::PropertyNotFound(name.clone()))
                            }
                        }
                        Err(e) => Err(e),
                    }
                } else {
                    self.get_property(&value, name)
                }
            }
            QueryPath::Index(idx, inner) => {
                context.block_index = Some(*idx);
                let value = self.execute_with_context(inner, context)?;
                self.get_index(&value, *idx)
            }
            QueryPath::Range { start, end, inner } => {
                let value = self.execute_with_context(inner, context)?;
                self.get_range(&value, *start, *end)
            }
            QueryPath::Filter {
                field,
                operator,
                value,
                inner,
            } => {
                let array_value = self.execute_with_context(inner, context)?;
                self.apply_filter(&array_value, field, operator, value)
            }
            QueryPath::ScopeResolve {
                property,
                scopes,
                inner,
            } => {
                // Execute inner path to establish context
                let _context_value = self.execute_with_context(inner, context)?;

                // Now resolve the property using scope inheritance
                if let Some(resolver) = self.scope_resolver {
                    self.resolve_scoped_property_from_context(property, scopes, context, resolver)
                } else {
                    Err(QueryError::InvalidType(
                        "Scope resolution requires scope resolver. Use resolve command instead."
                            .to_string(),
                    ))
                }
            }
        }
    }

    fn get_node(&self, id: &str) -> Result<JsonValue, QueryError> {
        let node = self
            .network
            .nodes
            .iter()
            .find(|n| n.id() == id)
            .ok_or_else(|| QueryError::NodeNotFound(id.to_string()))?;

        // Build a logical representation without the React Flow /data/ wrapper
        // This allows queries like "branch-4/blocks" instead of "branch-4/data/blocks"
        match node {
            NodeData::Branch(branch) => {
                let mut node_obj = serde_json::Map::new();
                node_obj.insert("id".to_string(), JsonValue::String(branch.base.id.clone()));
                node_obj.insert(
                    "type".to_string(),
                    JsonValue::String(branch.base.type_.clone()),
                );
                if let Some(label) = &branch.base.label {
                    node_obj.insert("label".to_string(), JsonValue::String(label.clone()));
                }
                node_obj.insert(
                    "position".to_string(),
                    serde_json::to_value(&branch.base.position).map_err(|e| {
                        QueryError::InvalidType(format!("Failed to serialize position: {}", e))
                    })?,
                );

                // Add blocks directly (not under /data/)
                let blocks: Vec<JsonValue> = branch
                    .blocks
                    .iter()
                    .map(|b| {
                        let mut block_obj = serde_json::Map::new();
                        block_obj.insert("type".to_string(), JsonValue::String(b.type_.clone()));
                        if let Some(quantity) = b.quantity {
                            block_obj
                                .insert("quantity".to_string(), JsonValue::Number(quantity.into()));
                        }
                        // Add extra properties with unit formatting (only in non-WASM builds)
                        #[cfg(not(target_arch = "wasm32"))]
                        {
                            // Collect original strings first
                            let mut original_strings = std::collections::HashMap::new();
                            for key in b.extra.keys() {
                                let original_key = format!("_{}_original", key);
                                if let Some(original_value) = b.extra.get(&original_key) {
                                    if let Some(original_str) = original_value.as_str() {
                                        original_strings
                                            .insert(original_key, original_str.to_string());
                                    }
                                }
                            }

                            // Build unit preferences with original strings
                            let mut block_unit_prefs = self.unit_preferences.clone();
                            block_unit_prefs.original_strings = original_strings;

                            // Add extra properties with unit formatting
                            let mut formatter = UnitFormatter::new();
                            for (key, value) in &b.extra {
                                // Skip _property_original keys
                                if key.starts_with("_") && key.ends_with("_original") {
                                    continue;
                                }

                                let json_value = toml_to_json(value);

                                // Get schema metadata if available
                                let property_metadata = self
                                    .schema_registry
                                    .and_then(|reg| {
                                        self.schema_version
                                            .and_then(|v| reg.get_schema(v, &b.type_))
                                    })
                                    .and_then(|schema| schema.properties.get(key));

                                // Format with unit preferences
                                let formatted_value = formatter
                                    .format_property(
                                        key,
                                        &json_value,
                                        Some(&b.type_),
                                        &block_unit_prefs,
                                        property_metadata,
                                    )
                                    .unwrap_or(json_value);

                                block_obj.insert(key.clone(), formatted_value);
                            }
                        }
                        #[cfg(target_arch = "wasm32")]
                        {
                            // In WASM builds, just add properties as-is (no unit formatting)
                            for (key, value) in &b.extra {
                                block_obj.insert(key.clone(), toml_to_json(value));
                            }
                        }
                        JsonValue::Object(block_obj)
                    })
                    .collect();
                node_obj.insert("blocks".to_string(), JsonValue::Array(blocks));

                // Add outgoing if present
                if !branch.outgoing.is_empty() {
                    let outgoing: Vec<JsonValue> = branch
                        .outgoing
                        .iter()
                        .map(|o| {
                            let mut out_obj = serde_json::Map::new();
                            out_obj
                                .insert("target".to_string(), JsonValue::String(o.target.clone()));
                            out_obj
                                .insert("weight".to_string(), JsonValue::Number(o.weight.into()));
                            JsonValue::Object(out_obj)
                        })
                        .collect();
                    node_obj.insert("outgoing".to_string(), JsonValue::Array(outgoing));
                }

                if let Some(parent_id) = &branch.base.parent_id {
                    node_obj.insert("parentId".to_string(), JsonValue::String(parent_id.clone()));
                }

                Ok(JsonValue::Object(node_obj))
            }
            NodeData::Group(group) => {
                let mut node_obj = serde_json::Map::new();
                node_obj.insert("id".to_string(), JsonValue::String(group.base.id.clone()));
                node_obj.insert(
                    "type".to_string(),
                    JsonValue::String(group.base.type_.clone()),
                );
                if let Some(label) = &group.base.label {
                    node_obj.insert("label".to_string(), JsonValue::String(label.clone()));
                }
                node_obj.insert(
                    "position".to_string(),
                    serde_json::to_value(&group.base.position).map_err(|e| {
                        QueryError::InvalidType(format!("Failed to serialize position: {}", e))
                    })?,
                );
                if let Some(parent_id) = &group.base.parent_id {
                    node_obj.insert("parentId".to_string(), JsonValue::String(parent_id.clone()));
                }
                Ok(JsonValue::Object(node_obj))
            }
            NodeData::GeographicAnchor(anchor) => {
                let mut node_obj = serde_json::Map::new();
                node_obj.insert("id".to_string(), JsonValue::String(anchor.base.id.clone()));
                node_obj.insert(
                    "type".to_string(),
                    JsonValue::String(anchor.base.type_.clone()),
                );
                if let Some(label) = &anchor.base.label {
                    node_obj.insert("label".to_string(), JsonValue::String(label.clone()));
                }
                node_obj.insert(
                    "position".to_string(),
                    serde_json::to_value(&anchor.base.position).map_err(|e| {
                        QueryError::InvalidType(format!("Failed to serialize position: {}", e))
                    })?,
                );
                Ok(JsonValue::Object(node_obj))
            }
            NodeData::GeographicWindow(window) => {
                let mut node_obj = serde_json::Map::new();
                node_obj.insert("id".to_string(), JsonValue::String(window.base.id.clone()));
                node_obj.insert(
                    "type".to_string(),
                    JsonValue::String(window.base.type_.clone()),
                );
                if let Some(label) = &window.base.label {
                    node_obj.insert("label".to_string(), JsonValue::String(label.clone()));
                }
                node_obj.insert(
                    "position".to_string(),
                    serde_json::to_value(&window.base.position).map_err(|e| {
                        QueryError::InvalidType(format!("Failed to serialize position: {}", e))
                    })?,
                );
                Ok(JsonValue::Object(node_obj))
            }
        }
    }

    fn get_property(&self, value: &JsonValue, name: &str) -> Result<JsonValue, QueryError> {
        match value {
            JsonValue::Object(map) => {
                // Handle backward compatibility: if "data" is requested, return the object itself
                // (since we now expose properties directly without the /data/ wrapper)
                if name == "data" {
                    return Ok(value.clone());
                }
                map.get(name)
                    .cloned()
                    .ok_or_else(|| QueryError::PropertyNotFound(name.to_string()))
            }
            _ => Err(QueryError::InvalidType(format!(
                "Cannot access property '{}' on non-object",
                name
            ))),
        }
    }

    fn get_index(&self, value: &JsonValue, idx: usize) -> Result<JsonValue, QueryError> {
        match value {
            JsonValue::Array(arr) => {
                if idx >= arr.len() {
                    return Err(QueryError::IndexOutOfRange(idx, arr.len()));
                }
                Ok(arr[idx].clone())
            }
            _ => Err(QueryError::InvalidType(format!(
                "Cannot index into non-array (index: {})",
                idx
            ))),
        }
    }

    fn get_range(
        &self,
        value: &JsonValue,
        start: Option<usize>,
        end: Option<usize>,
    ) -> Result<JsonValue, QueryError> {
        match value {
            JsonValue::Array(arr) => {
                let start_idx = start.unwrap_or(0);
                let end_idx = end.unwrap_or(arr.len().saturating_sub(1));

                // Validate bounds
                if start_idx >= arr.len() {
                    return Err(QueryError::IndexOutOfRange(start_idx, arr.len()));
                }
                if end_idx >= arr.len() {
                    return Err(QueryError::IndexOutOfRange(end_idx, arr.len()));
                }
                if start_idx > end_idx {
                    return Err(QueryError::InvalidType(format!(
                        "Range start ({}) must be <= end ({})",
                        start_idx, end_idx
                    )));
                }

                // Extract slice (inclusive end, like Python's [start:end+1])
                let slice: Vec<JsonValue> = arr[start_idx..=end_idx].to_vec();
                Ok(JsonValue::Array(slice))
            }
            _ => Err(QueryError::InvalidType(
                "Cannot apply range to non-array".to_string(),
            )),
        }
    }

    fn apply_filter(
        &self,
        value: &JsonValue,
        field: &str,
        operator: &FilterOperator,
        filter_value: &str,
    ) -> Result<JsonValue, QueryError> {
        match value {
            JsonValue::Array(arr) => {
                let filtered: Vec<JsonValue> = arr
                    .iter()
                    .filter(|item| {
                        // Handle nested property access (e.g., data.type, position.x)
                        let field_value = if field.contains('.') {
                            self.get_nested_property(item, field)
                        } else {
                            self.get_property(item, field)
                        };

                        match field_value {
                            Ok(fv) => self
                                .matches_filter_value(&fv, operator, filter_value)
                                .unwrap_or_default(),
                            Err(_) => false,
                        }
                    })
                    .cloned()
                    .collect();
                Ok(JsonValue::Array(filtered))
            }
            _ => Err(QueryError::InvalidType(
                "Filter can only be applied to arrays".to_string(),
            )),
        }
    }

    fn get_nested_property(&self, value: &JsonValue, path: &str) -> Result<JsonValue, QueryError> {
        let parts: Vec<&str> = path.split('.').collect();
        let mut current = value.clone();

        for part in parts {
            current = self.get_property(&current, part)?;
        }

        Ok(current)
    }

    fn matches_filter_value(
        &self,
        field_value: &JsonValue,
        operator: &FilterOperator,
        filter_value: &str,
    ) -> Result<bool, QueryError> {
        match operator {
            FilterOperator::Equals => Ok(matches_value(field_value, filter_value)),
            FilterOperator::NotEquals => Ok(!matches_value(field_value, filter_value)),
            FilterOperator::GreaterThan => compare_numeric(field_value, filter_value, |a, b| a > b),
            FilterOperator::LessThan => compare_numeric(field_value, filter_value, |a, b| a < b),
            FilterOperator::GreaterThanOrEqual => {
                compare_numeric(field_value, filter_value, |a, b| a >= b)
            }
            FilterOperator::LessThanOrEqual => {
                compare_numeric(field_value, filter_value, |a, b| a <= b)
            }
        }
    }
}

fn matches_value(value: &JsonValue, filter_value: &str) -> bool {
    match value {
        JsonValue::String(s) => s == filter_value,
        JsonValue::Number(n) => {
            if let (Some(n_val), Ok(f_val)) = (n.as_f64(), filter_value.parse::<f64>()) {
                (n_val - f_val).abs() < f64::EPSILON
            } else {
                false
            }
        }
        JsonValue::Bool(b) => {
            if let Ok(f_val) = filter_value.parse::<bool>() {
                *b == f_val
            } else {
                false
            }
        }
        _ => false,
    }
}

fn compare_numeric<F>(value: &JsonValue, filter_value: &str, cmp: F) -> Result<bool, QueryError>
where
    F: FnOnce(f64, f64) -> bool,
{
    let n_val = match value {
        JsonValue::Number(n) => n
            .as_f64()
            .ok_or_else(|| QueryError::InvalidType("Cannot convert number".to_string()))?,
        _ => {
            return Err(QueryError::InvalidType(
                "Comparison operators only work with numbers".to_string(),
            ))
        }
    };

    let f_val = filter_value.parse::<f64>().map_err(|_| {
        QueryError::InvalidType(format!(
            "Cannot parse filter value as number: {}",
            filter_value
        ))
    })?;

    Ok(cmp(n_val, f_val))
}

impl<'a> QueryExecutor<'a> {
    fn resolve_scoped_property_from_context(
        &self,
        property: &str,
        explicit_scopes: &[String],
        context: &QueryContext,
        resolver: &crate::scope::resolver::ScopeResolver,
    ) -> Result<JsonValue, QueryError> {
        // Extract node ID and block index from context
        let node_id = context.node_id.as_ref().ok_or_else(|| {
            QueryError::InvalidType("Scope resolution requires a node context".to_string())
        })?;

        let block_index = context.block_index.ok_or_else(|| {
            QueryError::InvalidType(
                "Scope resolution requires a block context (use path like branch-4/blocks/0)"
                    .to_string(),
            )
        })?;

        // Find the branch node
        let branch_node = self
            .network
            .nodes
            .iter()
            .find_map(|n| match n {
                NodeData::Branch(b) if b.base.id == *node_id => Some(b),
                _ => None,
            })
            .ok_or_else(|| QueryError::NodeNotFound(node_id.clone()))?;

        // Get the block
        let block = branch_node
            .blocks
            .get(block_index)
            .ok_or(QueryError::IndexOutOfRange(
                block_index,
                branch_node.blocks.len(),
            ))?;

        // Find the group if parent_id exists
        let group = branch_node.base.parent_id.as_ref().and_then(|parent_id| {
            self.network.nodes.iter().find_map(|n| match n {
                NodeData::Group(g) if g.base.id == *parent_id => Some(g),
                _ => None,
            })
        });

        // Parse explicit scopes from query string to ScopeLevel enums
        let scope_levels: Vec<crate::scope::config::ScopeLevel> = explicit_scopes
            .iter()
            .filter_map(|s| match s.to_lowercase().as_str() {
                "block" => Some(crate::scope::config::ScopeLevel::Block),
                "branch" => Some(crate::scope::config::ScopeLevel::Branch),
                "group" => Some(crate::scope::config::ScopeLevel::Group),
                "global" => Some(crate::scope::config::ScopeLevel::Global),
                _ => None,
            })
            .collect();

        // Resolve the property using explicit scopes if provided, otherwise use config defaults
        let value = if !scope_levels.is_empty() {
            resolver
                .resolve_property_with_explicit_scopes(
                    property,
                    block,
                    branch_node,
                    group,
                    &scope_levels,
                )
                .map(|(v, _)| v)
        } else {
            resolver.resolve_property(property, block, branch_node, group)
        };

        // Convert TOML Value to JSON Value
        match value {
            Some(v) => Ok(toml_to_json(&v)),
            None => Err(QueryError::PropertyNotFound(format!(
                "Property '{}' not found in any scope",
                property
            ))),
        }
    }
}

// Helper function to convert TOML Value to JSON Value
pub fn toml_to_json(value: &TomlValue) -> JsonValue {
    match value {
        TomlValue::String(s) => JsonValue::String(s.clone()),
        TomlValue::Integer(i) => JsonValue::Number((*i).into()),
        TomlValue::Float(f) => {
            // TOML floats are f64, JSON numbers can represent them
            serde_json::Number::from_f64(*f)
                .map(JsonValue::Number)
                .unwrap_or(JsonValue::Null)
        }
        TomlValue::Boolean(b) => JsonValue::Bool(*b),
        TomlValue::Datetime(dt) => JsonValue::String(dt.to_string()),
        TomlValue::Array(arr) => JsonValue::Array(arr.iter().map(toml_to_json).collect()),
        TomlValue::Table(table) => {
            let mut map = serde_json::Map::new();
            for (k, v) in table {
                map.insert(k.clone(), toml_to_json(v));
            }
            JsonValue::Object(map)
        }
    }
}
