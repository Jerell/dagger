// Registry for managing property configurations
// This can be extended later for property metadata, validation, etc.

use crate::scope::config::*;
use toml::Value;

pub struct PropertyRegistry {
    config: Config,
}

impl PropertyRegistry {
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    pub fn get_global_property(&self, name: &str) -> Option<&Value> {
        self.config.properties.get(name)
    }

    pub fn list_global_properties(&self) -> Vec<&String> {
        self.config.properties.keys().collect()
    }

    pub fn has_inheritance_rule(&self, property: &str) -> bool {
        self.config.inheritance.rules.contains_key(property)
    }
}

