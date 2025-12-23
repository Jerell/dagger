#[derive(Debug, Clone, PartialEq)]
pub enum QueryPath {
    // Node by ID: "branch-4"
    Node(String),
    // Property access: "branch-4/label"
    Property(String, Box<QueryPath>),
    // Array index: "branch-4/blocks/0"
    Index(usize, Box<QueryPath>),
    // Nested property: "branch-4/position/x"
    Nested(String, Box<QueryPath>),
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
