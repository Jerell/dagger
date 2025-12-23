#[derive(Debug, Clone, PartialEq)]
pub enum QueryPath {
    // Node by ID: "branch-4"
    Node(String),
    // Property access: "branch-4/label"
    Property(String, Box<QueryPath>),
    // Array index: "branch-4/blocks/0"
    Index(usize, Box<QueryPath>),
    // Filter: "branch-4/blocks[type=Compressor]"
    Filter {
        field: String,
        operator: FilterOperator,
        value: String,
        inner: Box<QueryPath>,
    },
    // Scope resolution: "branch-4/blocks/0/ambientTemperature?scope=block,branch,group"
    ScopeResolve {
        property: String,
        scopes: Vec<String>,
        inner: Box<QueryPath>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum FilterOperator {
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    GreaterThanOrEqual,
    LessThanOrEqual,
}

#[derive(Debug)]
pub enum ParseError {
    EmptyPath,
    InvalidIndex(String),
    UnexpectedEnd,
    InvalidCharacter(char, usize),
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::EmptyPath => write!(f, "Query path cannot be empty"),
            ParseError::InvalidIndex(s) => write!(f, "Invalid index: {}", s),
            ParseError::UnexpectedEnd => write!(f, "Unexpected end of path"),
            ParseError::InvalidCharacter(c, pos) => {
                write!(f, "Invalid character '{}' at position {}", c, pos)
            }
        }
    }
}

impl std::error::Error for ParseError {}

pub fn parse_query_path(path: &str) -> Result<QueryPath, ParseError> {
    if path.is_empty() {
        return Err(ParseError::EmptyPath);
    }

    // Check for network-level queries (start with "nodes" or "edges")
    if path.starts_with("nodes") || path.starts_with("edges") {
        return parse_network_query(path);
    }

    // Check for scope resolution query (has ?scope=...)
    if let Some((base_path, scope_part)) = path.split_once('?') {
        if let Some(scope_str) = scope_part.strip_prefix("scope=") {
            // Parse the base path first
            // Extract property name from the end of the path
            let parts: Vec<&str> = base_path.split('/').collect();
            if parts.is_empty() {
                return Err(ParseError::UnexpectedEnd);
            }

            let property = parts.last().unwrap().to_string();
            let scopes: Vec<String> = scope_str.split(',').map(|s| s.trim().to_string()).collect();

            // Remove property from inner path - rebuild path without last part
            let inner_parts: Vec<&str> = base_path.split('/').collect();
            let inner_base = if inner_parts.len() > 1 {
                inner_parts[..inner_parts.len() - 1].join("/")
            } else {
                inner_parts[0].to_string()
            };
            let inner = parse_query_path(&inner_base)?;

            return Ok(QueryPath::ScopeResolve {
                property,
                scopes,
                inner: Box::new(inner),
            });
        }
    }

    let parts: Vec<&str> = path.split('/').collect();
    if parts.is_empty() {
        return Err(ParseError::EmptyPath);
    }

    // Start with the node ID
    let node_id = parts[0].to_string();
    let mut current: QueryPath = QueryPath::Node(node_id);

    // Process remaining parts
    for part in parts.into_iter().skip(1) {
        if part.is_empty() {
            continue;
        }

        // Check for filter syntax: property[field=value] or property[field>value]
        if let Some((property, field, operator, value)) = parse_filter(part)? {
            // Apply filter to the current path
            current = QueryPath::Filter {
                field,
                operator,
                value,
                inner: Box::new(QueryPath::Property(property, Box::new(current))),
            };
            continue;
        }

        // Check if it's a numeric index
        if let Ok(index) = part.parse::<usize>() {
            current = QueryPath::Index(index, Box::new(current));
        } else {
            // It's a property name
            current = QueryPath::Property(part.to_string(), Box::new(current));
        }
    }

    Ok(current)
}

fn parse_filter(
    part: &str,
) -> Result<Option<(String, String, FilterOperator, String)>, ParseError> {
    // Look for [field=value] or [field>value] etc.
    if let Some(bracket_start) = part.find('[') {
        if let Some(bracket_end) = part.find(']') {
            let property = part[..bracket_start].to_string();
            let filter_expr = &part[bracket_start + 1..bracket_end];

            // Parse filter expression: field=value, field>value, etc.
            let (field, operator, value) = parse_filter_expression(filter_expr)?;

            return Ok(Some((property, field, operator, value)));
        }
    }
    Ok(None)
}

fn parse_filter_expression(expr: &str) -> Result<(String, FilterOperator, String), ParseError> {
    // Try different operators
    if let Some(pos) = expr.find(">=") {
        let field = expr[..pos].trim().to_string();
        let value = expr[pos + 2..].trim().to_string();
        return Ok((field, FilterOperator::GreaterThanOrEqual, value));
    }
    if let Some(pos) = expr.find("<=") {
        let field = expr[..pos].trim().to_string();
        let value = expr[pos + 2..].trim().to_string();
        return Ok((field, FilterOperator::LessThanOrEqual, value));
    }
    if let Some(pos) = expr.find("!=") {
        let field = expr[..pos].trim().to_string();
        let value = expr[pos + 2..].trim().to_string();
        return Ok((field, FilterOperator::NotEquals, value));
    }
    if let Some(pos) = expr.find('>') {
        let field = expr[..pos].trim().to_string();
        let value = expr[pos + 1..].trim().to_string();
        return Ok((field, FilterOperator::GreaterThan, value));
    }
    if let Some(pos) = expr.find('<') {
        let field = expr[..pos].trim().to_string();
        let value = expr[pos + 1..].trim().to_string();
        return Ok((field, FilterOperator::LessThan, value));
    }
    if let Some(pos) = expr.find('=') {
        let field = expr[..pos].trim().to_string();
        let value = expr[pos + 1..].trim().to_string();
        return Ok((field, FilterOperator::Equals, value));
    }

    Err(ParseError::InvalidCharacter('=', 0))
}

fn parse_network_query(path: &str) -> Result<QueryPath, ParseError> {
    // Parse network-level queries like:
    // nodes[type=branchNode]
    // edges[source=branch-1]
    // nodes
    // edges

    if path == "nodes" {
        return Ok(QueryPath::Property(
            "nodes".to_string(),
            Box::new(QueryPath::Node("network".to_string())),
        ));
    }

    if path == "edges" {
        return Ok(QueryPath::Property(
            "edges".to_string(),
            Box::new(QueryPath::Node("network".to_string())),
        ));
    }

    // Handle filters on nodes/edges
    if let Some(bracket_start) = path.find('[') {
        if let Some(bracket_end) = path.find(']') {
            let collection = &path[..bracket_start];
            let filter_expr = &path[bracket_start + 1..bracket_end];

            if collection == "nodes" || collection == "edges" {
                let (field, operator, value) = parse_filter_expression(filter_expr)?;

                return Ok(QueryPath::Filter {
                    field,
                    operator,
                    value,
                    inner: Box::new(QueryPath::Property(
                        collection.to_string(),
                        Box::new(QueryPath::Node("network".to_string())),
                    )),
                });
            }
        }
    }

    Err(ParseError::InvalidCharacter('?', 0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_node() {
        let result = parse_query_path("branch-4").unwrap();
        assert!(matches!(result, QueryPath::Node(id) if id == "branch-4"));
    }

    #[test]
    fn test_parse_property() {
        let result = parse_query_path("branch-4/label").unwrap();
        match result {
            QueryPath::Property(name, inner) => {
                assert_eq!(name, "label");
                assert!(matches!(*inner, QueryPath::Node(id) if id == "branch-4"));
            }
            _ => panic!("Expected Property"),
        }
    }

    #[test]
    fn test_parse_index() {
        let result = parse_query_path("branch-4/blocks/0").unwrap();
        match result {
            QueryPath::Index(0, inner) => match *inner {
                QueryPath::Property(name, inner2) => {
                    assert_eq!(name, "blocks");
                    assert!(matches!(*inner2, QueryPath::Node(id) if id == "branch-4"));
                }
                _ => panic!("Expected Property"),
            },
            _ => panic!("Expected Index"),
        }
    }

    #[test]
    fn test_parse_nested() {
        let result = parse_query_path("branch-4/position/x").unwrap();
        match result {
            QueryPath::Property(x, inner) => {
                assert_eq!(x, "x");
                match *inner {
                    QueryPath::Property(pos, inner2) => {
                        assert_eq!(pos, "position");
                        assert!(matches!(*inner2, QueryPath::Node(id) if id == "branch-4"));
                    }
                    _ => panic!("Expected nested Property"),
                }
            }
            _ => panic!("Expected Property"),
        }
    }
}
