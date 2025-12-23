use crate::parser::models::Block;
use crate::schema::registry::SchemaRegistry;
use std::collections::HashSet;

#[derive(Debug, Clone)]
pub struct ValidationIssue {
    pub severity: IssueSeverity,
    pub message: String,
    pub property: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IssueSeverity {
    Error,
    Warning,
}

#[derive(Debug)]
pub struct ValidationResult {
    pub issues: Vec<ValidationIssue>,
}

impl ValidationResult {
    pub fn new() -> Self {
        Self { issues: Vec::new() }
    }

    pub fn add_error(&mut self, message: String, property: Option<String>) {
        self.issues.push(ValidationIssue {
            severity: IssueSeverity::Error,
            message,
            property,
        });
    }

    pub fn add_warning(&mut self, message: String, property: Option<String>) {
        self.issues.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            message,
            property,
        });
    }

    pub fn is_valid(&self) -> bool {
        !self
            .issues
            .iter()
            .any(|i| i.severity == IssueSeverity::Error)
    }

    pub fn has_issues(&self) -> bool {
        !self.issues.is_empty()
    }
}

impl Default for ValidationResult {
    fn default() -> Self {
        Self::new()
    }
}

pub struct SchemaValidator {
    registry: SchemaRegistry,
}

impl SchemaValidator {
    pub fn new(registry: SchemaRegistry) -> Self {
        Self { registry }
    }

    pub fn validate_block(&self, block: &Block, schema_version: &str) -> ValidationResult {
        let mut result = ValidationResult::new();

        // Get schema for this block type
        let schema = match self.registry.get_schema(schema_version, &block.type_) {
            Some(s) => s,
            None => {
                result.add_warning(
                    format!(
                        "No schema found for block type '{}' in version '{}'",
                        block.type_, schema_version
                    ),
                    None,
                );
                return result;
            }
        };

        // Check required properties
        let block_properties: HashSet<&String> = block.extra.keys().collect();

        for required_prop in &schema.required_properties {
            if !block_properties.contains(required_prop) {
                result.add_error(
                    format!(
                        "Required property '{}' is missing for block type '{}'",
                        required_prop, block.type_
                    ),
                    Some(required_prop.clone()),
                );
            }
        }

        // Warn about unknown properties (not in required or optional)
        let known_properties: HashSet<&String> = schema
            .required_properties
            .iter()
            .chain(schema.optional_properties.iter())
            .collect();

        for prop in &block_properties {
            if !known_properties.contains(prop) {
                result.add_warning(
                    format!(
                        "Unknown property '{}' for block type '{}' (not in schema version '{}')",
                        prop, block.type_, schema_version
                    ),
                    Some(prop.to_string()),
                );
            }
        }

        result
    }
}
