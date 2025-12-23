use crate::parser::models::*;
use crate::query::parser::{FilterOperator, ParseError, QueryPath};
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
        }
    }

    pub fn with_scope_resolver(
        network: &'a Network,
        resolver: &'a crate::scope::resolver::ScopeResolver,
    ) -> Self {
        Self {
            network,
            scope_resolver: Some(resolver),
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
        
        self.execute_with_context(path, &mut QueryContext {
            node_id: None,
            block_index: None,
        })
    }
    
    fn execute_network_query(&self, collection: &str) -> Result<JsonValue, QueryError> {
        match collection {
            "nodes" => {
                let nodes: Vec<JsonValue> = self.network
                    .nodes
                    .iter()
                    .map(|n| {
                        let value = serde_json::to_value(n)
                            .map_err(|e| QueryError::InvalidType(format!("Failed to serialize: {}", e)))?;
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
                self.get_property(&value, name)
            }
            QueryPath::Index(idx, inner) => {
                context.block_index = Some(*idx);
                let value = self.execute_with_context(inner, context)?;
                self.get_index(&value, *idx)
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
                scopes: _,
                inner,
            } => {
                // Execute inner path to establish context
                let _context_value = self.execute_with_context(inner, context)?;
                
                // Now resolve the property using scope inheritance
                if let Some(resolver) = self.scope_resolver {
                    self.resolve_scoped_property_from_context(property, context, resolver)
                } else {
                    Err(QueryError::InvalidType(
                        "Scope resolution requires scope resolver. Use resolve command instead.".to_string(),
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

        // Serialize node to JSON
        let value = serde_json::to_value(node)
            .map_err(|e| QueryError::InvalidType(format!("Failed to serialize node: {}", e)))?;

        // The node is wrapped in an enum variant (e.g., {"branchNode": {...}})
        // Unwrap it to get the actual node object
        match value {
            JsonValue::Object(map) => {
                // Get the first (and only) value from the map
                if let Some((_, node_value)) = map.into_iter().next() {
                    Ok(node_value)
                } else {
                    Err(QueryError::InvalidType("Empty node object".to_string()))
                }
            }
            _ => Ok(value),
        }
    }

    fn get_property(&self, value: &JsonValue, name: &str) -> Result<JsonValue, QueryError> {
        match value {
            JsonValue::Object(map) => map
                .get(name)
                .cloned()
                .ok_or_else(|| QueryError::PropertyNotFound(name.to_string())),
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
                            Ok(fv) => {
                                match self.matches_filter_value(&fv, operator, filter_value) {
                                    Ok(matches) => matches,
                                    Err(_) => false,
                                }
                            }
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
            FilterOperator::GreaterThan => {
                compare_numeric(field_value, filter_value, |a, b| a > b)
            }
            FilterOperator::LessThan => {
                compare_numeric(field_value, filter_value, |a, b| a < b)
            }
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
        QueryError::InvalidType(format!("Cannot parse filter value as number: {}", filter_value))
    })?;

    Ok(cmp(n_val, f_val))
}

impl<'a> QueryExecutor<'a> {
    fn resolve_scoped_property_from_context(
        &self,
        property: &str,
        context: &QueryContext,
        resolver: &crate::scope::resolver::ScopeResolver,
    ) -> Result<JsonValue, QueryError> {
        // Extract node ID and block index from context
        let node_id = context
            .node_id
            .as_ref()
            .ok_or_else(|| QueryError::InvalidType(
                "Scope resolution requires a node context".to_string(),
            ))?;

        let block_index = context
            .block_index
            .ok_or_else(|| QueryError::InvalidType(
                "Scope resolution requires a block context (use path like branch-4/data/blocks/0)".to_string(),
            ))?;

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
            .ok_or_else(|| QueryError::IndexOutOfRange(block_index, branch_node.blocks.len()))?;

        // Find the group if parent_id exists
        let group = branch_node
            .base
            .parent_id
            .as_ref()
            .and_then(|parent_id| {
                self.network.nodes.iter().find_map(|n| match n {
                    NodeData::Group(g) if g.base.id == *parent_id => Some(g),
                    _ => None,
                })
            });

        // Resolve the property using scope inheritance
        let value = resolver.resolve_property(property, block, branch_node, group);

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
