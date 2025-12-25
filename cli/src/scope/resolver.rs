use crate::parser::models::*;
use crate::scope::config::*;
use toml::Value;

pub struct ScopeResolver {
    config: Config,
}

impl ScopeResolver {
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    pub fn resolve_property(
        &self,
        property: &str,
        block: &Block,
        branch: &BranchNode,
        group: Option<&GroupNode>,
    ) -> Option<Value> {
        self.resolve_property_with_scope(property, block, branch, group)
            .map(|(value, _)| value)
    }

    pub fn resolve_property_with_scope(
        &self,
        property: &str,
        block: &Block,
        branch: &BranchNode,
        group: Option<&GroupNode>,
    ) -> Option<(Value, ScopeLevel)> {
        let scope_chain = self.get_scope_chain(property, &block.type_);
        self.resolve_property_with_explicit_scopes(property, block, branch, group, &scope_chain)
    }

    pub fn resolve_property_with_explicit_scopes(
        &self,
        property: &str,
        block: &Block,
        branch: &BranchNode,
        group: Option<&GroupNode>,
        explicit_scopes: &[ScopeLevel],
    ) -> Option<(Value, ScopeLevel)> {
        // Walk up the chain until value found
        for scope in explicit_scopes {
            match scope {
                ScopeLevel::Block => {
                    if let Some(v) = block.extra.get(property) {
                        return Some((v.clone(), ScopeLevel::Block));
                    }
                }
                ScopeLevel::Branch => {
                    if let Some(v) = branch.base.extra.get(property) {
                        return Some((v.clone(), ScopeLevel::Branch));
                    }
                }
                ScopeLevel::Group => {
                    if let Some(v) = group.and_then(|g| g.base.extra.get(property)) {
                        return Some((v.clone(), ScopeLevel::Group));
                    }
                }
                ScopeLevel::Global => {
                    // Check config.toml [properties] section
                    if let Some(v) = self.config.properties.get(property) {
                        return Some((v.clone(), ScopeLevel::Global));
                    }
                }
            }
        }
        None
    }

    fn get_scope_chain(&self, property: &str, block_type: &str) -> Vec<ScopeLevel> {
        // Get inheritance rule for property, or use general default
        let rule = self.config.inheritance.rules.get(property);

        match rule {
            Some(PropertyInheritanceRule::Simple(scopes)) => scopes.clone(),
            Some(PropertyInheritanceRule::Complex {
                inheritance,
                overrides,
            }) => {
                // Check for block-type override
                overrides
                    .get(block_type)
                    .cloned()
                    .unwrap_or_else(|| inheritance.clone())
            }
            None => self.config.inheritance.general.clone(),
        }
    }

    pub fn get_scope_chain_for_property(
        &self,
        property: &str,
        block_type: Option<&str>,
    ) -> Vec<ScopeLevel> {
        if let Some(block_type) = block_type {
            self.get_scope_chain(property, block_type)
        } else {
            // No block type, use general or property-specific rule
            self.config
                .inheritance
                .rules
                .get(property)
                .map(|r| match r {
                    PropertyInheritanceRule::Simple(scopes) => scopes.clone(),
                    PropertyInheritanceRule::Complex { inheritance, .. } => inheritance.clone(),
                })
                .unwrap_or_else(|| self.config.inheritance.general.clone())
        }
    }

    pub fn has_global_property(&self, property: &str) -> bool {
        self.config.properties.contains_key(property)
    }
}
