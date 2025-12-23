use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use toml::Value;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    // Global property defaults
    #[serde(default)]
    pub properties: HashMap<String, Value>,

    // Inheritance configuration
    #[serde(default)]
    pub inheritance: InheritanceConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct InheritanceConfig {
    // Default inheritance chain for properties without explicit rules
    #[serde(default = "default_general_inheritance")]
    pub general: Vec<ScopeLevel>,

    // Per-property inheritance rules
    #[serde(default)]
    pub rules: HashMap<String, PropertyInheritanceRule>,
}

impl Default for InheritanceConfig {
    fn default() -> Self {
        Self {
            general: default_general_inheritance(),
            rules: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(untagged)]
pub enum PropertyInheritanceRule {
    // Simple: just a list of scopes
    Simple(Vec<ScopeLevel>),
    // Complex: with per-block-type overrides
    Complex {
        inheritance: Vec<ScopeLevel>,
        #[serde(default)]
        overrides: HashMap<String, Vec<ScopeLevel>>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ScopeLevel {
    Global,
    Group,
    Branch,
    Block,
}

fn default_general_inheritance() -> Vec<ScopeLevel> {
    vec![
        ScopeLevel::Block,
        ScopeLevel::Branch,
        ScopeLevel::Group,
        ScopeLevel::Global,
    ]
}

impl Config {
    pub fn load_from_file<P: AsRef<std::path::Path>>(
        path: P,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let content = std::fs::read_to_string(path)?;
        let config: Config = toml::from_str(&content)?;
        Ok(config)
    }

    pub fn empty() -> Self {
        Self {
            properties: HashMap::new(),
            inheritance: InheritanceConfig {
                general: default_general_inheritance(),
                rules: HashMap::new(),
            },
        }
    }
}
