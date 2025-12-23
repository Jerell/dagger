use std::fmt;

#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub errors: Vec<ValidationIssue>,
    pub warnings: Vec<ValidationIssue>,
}

#[derive(Debug, Clone)]
pub struct ValidationIssue {
    pub severity: IssueSeverity,
    pub message: String,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IssueSeverity {
    Error,
    Warning,
}

impl ValidationResult {
    pub fn new() -> Self {
        Self {
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }
    
    pub fn add_error(&mut self, message: String, location: Option<String>) {
        self.errors.push(ValidationIssue {
            severity: IssueSeverity::Error,
            message,
            location,
        });
    }
    
    pub fn add_warning(&mut self, message: String, location: Option<String>) {
        self.warnings.push(ValidationIssue {
            severity: IssueSeverity::Warning,
            message,
            location,
        });
    }
    
    pub fn is_valid(&self) -> bool {
        self.errors.is_empty()
    }
    
    pub fn has_issues(&self) -> bool {
        !self.errors.is_empty() || !self.warnings.is_empty()
    }
}

impl Default for ValidationResult {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for ValidationResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if !self.errors.is_empty() {
            writeln!(f, "Errors:")?;
            for error in &self.errors {
                if let Some(loc) = &error.location {
                    writeln!(f, "  [{}] {}", loc, error.message)?;
                } else {
                    writeln!(f, "  {}", error.message)?;
                }
            }
        }
        
        if !self.warnings.is_empty() {
            writeln!(f, "Warnings:")?;
            for warning in &self.warnings {
                if let Some(loc) = &warning.location {
                    writeln!(f, "  [{}] {}", loc, warning.message)?;
                } else {
                    writeln!(f, "  {}", warning.message)?;
                }
            }
        }
        
        Ok(())
    }
}

