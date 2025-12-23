use crate::parser::models::*;
use crate::query::parser::*;
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
}

impl<'a> QueryExecutor<'a> {
    pub fn new(network: &'a Network) -> Self {
        Self { network }
    }

    pub fn execute(&self, path: &QueryPath) -> Result<JsonValue, QueryError> {
        match path {
            QueryPath::Node(id) => self.get_node(id),
            QueryPath::Property(name, inner) => {
                let value = self.execute(inner)?;
                self.get_property(&value, name)
            }
            QueryPath::Index(idx, inner) => {
                let value = self.execute(inner)?;
                self.get_index(&value, *idx)
            }
            QueryPath::Nested(name, inner) => {
                let value = self.execute(inner)?;
                self.get_property(&value, name)
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
