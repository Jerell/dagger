use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct SchemaLibrary {
    pub version: String,
    pub schemas: HashMap<String, SchemaDefinition>, // block_type -> schema
}

#[derive(Debug, Clone)]
pub struct SchemaDefinition {
    pub block_type: String,
    pub version: String,
    pub required_properties: Vec<String>,
    pub optional_properties: Vec<String>,
}

pub struct SchemaRegistry {
    libraries: HashMap<String, SchemaLibrary>, // version -> library
    schemas_dir: PathBuf,
}

impl SchemaRegistry {
    pub fn new(schemas_dir: PathBuf) -> Self {
        Self {
            libraries: HashMap::new(),
            schemas_dir,
        }
    }

    pub fn load_library(&mut self, version: &str) -> Result<(), Box<dyn std::error::Error>> {
        let version_dir = self.schemas_dir.join(version);

        if !version_dir.exists() {
            return Err(format!(
                "Schema library version '{}' not found at {}",
                version,
                version_dir.display()
            )
            .into());
        }

        let mut schemas = HashMap::new();

        // Scan for schema files
        // We support JSON files (generated from Zod schemas via generate-schemas.ts)
        // The TypeScript/Zod files are the source of truth
        let entries = std::fs::read_dir(&version_dir)?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                // Load schema definition from JSON (generated from Zod)
                let content = std::fs::read_to_string(&path)?;
                let schema_json: SchemaJson = serde_json::from_str(&content)?;
                let schema: SchemaDefinition = schema_json.into();
                schemas.insert(schema.block_type.clone(), schema);
            }
        }

        self.libraries.insert(
            version.to_string(),
            SchemaLibrary {
                version: version.to_string(),
                schemas,
            },
        );

        Ok(())
    }

    /// Load schema library from file contents (filename -> content map)
    /// This is used when files are read in Node.js and passed to WASM
    pub fn load_library_from_files(
        &mut self,
        version: &str,
        files: HashMap<String, String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut schemas = HashMap::new();

        // Process each schema file
        for (_filename, content) in files {
            let schema_json: SchemaJson = serde_json::from_str(&content)?;
            let schema: SchemaDefinition = schema_json.into();
            schemas.insert(schema.block_type.clone(), schema);
        }

        self.libraries.insert(
            version.to_string(),
            SchemaLibrary {
                version: version.to_string(),
                schemas,
            },
        );

        Ok(())
    }

    pub fn get_schema(&self, version: &str, block_type: &str) -> Option<&SchemaDefinition> {
        self.libraries
            .get(version)
            .and_then(|lib| lib.schemas.get(block_type))
    }

    pub fn list_versions(&self) -> Vec<&String> {
        self.libraries.keys().collect()
    }

    pub fn list_block_types(&self, version: &str) -> Vec<&String> {
        self.libraries
            .get(version)
            .map(|lib| lib.schemas.keys().collect())
            .unwrap_or_default()
    }
}

// JSON format for schema definitions (simpler than parsing TypeScript/Zod)
#[derive(Debug, Clone, serde::Deserialize)]
struct SchemaJson {
    block_type: String,
    version: String,
    required: Vec<String>,
    #[serde(default)]
    optional: Vec<String>,
}

impl From<SchemaJson> for SchemaDefinition {
    fn from(json: SchemaJson) -> Self {
        Self {
            block_type: json.block_type,
            version: json.version,
            required_properties: json.required,
            optional_properties: json.optional,
        }
    }
}
