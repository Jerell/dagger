use clap::{Parser, Subcommand};
use dagger::parser;
use dagger::query;
use dagger::schema;
use dagger::scope;

#[derive(Parser)]
#[command(name = "dagger")]
#[command(about = "Network configuration parser and query tool", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Export network as JSON
    Export {
        /// Network directory path
        #[arg(default_value = "../network/preset1")]
        path: String,

        /// Output file (default: stdout)
        #[arg(short, long)]
        output: Option<String>,
    },

    /// List all nodes in the network
    List {
        /// Network directory path
        #[arg(default_value = "../network/preset1")]
        path: String,
    },

    /// Query a specific path in the network
    Query {
        /// Query path (e.g., "branch-4/label")
        query: String,

        /// Network directory path
        #[arg(default_value = "../network/preset1")]
        path: String,
    },

    /// Resolve a property value using scope inheritance
    Resolve {
        /// Node ID (e.g., "branch-4")
        node_id: String,

        /// Block index (0-based)
        block_index: usize,

        /// Property name to resolve
        property: String,

        /// Network directory path
        #[arg(default_value = "../network/preset1")]
        path: String,
    },

    /// Validate blocks against schema libraries
    Validate {
        /// Schema version to use (e.g., "v1.0")
        version: String,

        /// Network directory path
        #[arg(default_value = "../network/preset1")]
        path: String,

        /// Schemas directory path
        #[arg(long, default_value = "../schemas")]
        schemas_dir: String,
    },
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Export { path, output } => match export_network(&path, output.as_deref()) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        },
        Commands::List { path } => match list_nodes(&path) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        },
        Commands::Query { query, path } => match query_network(&path, &query) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        },
        Commands::Resolve {
            node_id,
            block_index,
            property,
            path,
        } => match resolve_property(&path, &node_id, block_index, &property) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        },
        Commands::Validate {
            version,
            path,
            schemas_dir,
        } => match validate_network(&path, &version, &schemas_dir) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        },
    }
}

fn export_network(path: &str, output: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
    let (network, validation) = parser::load_network_from_directory(path)?;

    // Print validation issues if any
    if validation.has_issues() {
        eprintln!("{}", validation);
    }

    let json = serde_json::to_string_pretty(&network)?;

    if let Some(output_path) = output {
        std::fs::write(output_path, json)?;
        println!("Network exported to {}", output_path);
    } else {
        println!("{}", json);
    }

    Ok(())
}

fn list_nodes(path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let (network, validation) = parser::load_network_from_directory(path)?;

    // Print validation issues if any
    if validation.has_issues() {
        eprintln!("{}", validation);
    }

    println!("Network: {} ({})", network.label, network.id);
    println!("\nNodes ({}):", network.nodes.len());
    for node in &network.nodes {
        let base = node.base();
        println!(
            "  - {} ({}) at ({}, {})",
            base.id,
            base.label_display(),
            base.position.x,
            base.position.y
        );
    }

    println!("\nEdges ({}):", network.edges.len());
    for edge in &network.edges {
        println!(
            "  - {} -> {} (weight: {})",
            edge.source, edge.target, edge.data.weight
        );
    }

    Ok(())
}

fn query_network(path: &str, query_str: &str) -> Result<(), Box<dyn std::error::Error>> {
    let (network, validation) = parser::load_network_from_directory(path)?;

    // Print validation issues if any
    if validation.has_issues() {
        eprintln!("{}", validation);
    }

    // Parse the query path
    let query_path = query::parser::parse_query_path(query_str)
        .map_err(|e| format!("Failed to parse query: {}", e))?;

    // Load config for scope resolution (always load it, even if not needed)
    let config_path = std::path::Path::new(path).join("config.toml");
    let config = if config_path.exists() {
        scope::config::Config::load_from_file(&config_path)?
    } else {
        scope::config::Config::empty()
    };
    let resolver = scope::resolver::ScopeResolver::new(config);

    // Create executor with scope resolver (it will use it if needed)
    let executor = query::executor::QueryExecutor::with_scope_resolver(&network, &resolver);
    let result = executor
        .execute(&query_path)
        .map_err(|e| format!("Query error: {}", e))?;

    // Format and print the result
    let formatted = query::formatter::format_query_result(&result);
    println!("{}", formatted);

    Ok(())
}

fn resolve_property(
    path: &str,
    node_id: &str,
    block_index: usize,
    property: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let (network, _validation) = parser::load_network_from_directory(path)?;

    // Load config
    let config_path = std::path::Path::new(path).join("config.toml");
    let config = if config_path.exists() {
        scope::config::Config::load_from_file(&config_path)?
    } else {
        scope::config::Config::empty()
    };

    let resolver = scope::resolver::ScopeResolver::new(config);

    // Find the node
    let branch_node = network
        .nodes
        .iter()
        .find_map(|n| match n {
            parser::models::NodeData::Branch(b) if b.base.id == node_id => Some(b),
            _ => None,
        })
        .ok_or_else(|| format!("Node '{}' not found or is not a branch node", node_id))?;

    // Get the block
    let block = branch_node.blocks.get(block_index).ok_or_else(|| {
        format!(
            "Block index {} out of range ({} blocks)",
            block_index,
            branch_node.blocks.len()
        )
    })?;

    // Find the group if parent_id exists
    let group = branch_node.base.parent_id.as_ref().and_then(|parent_id| {
        network.nodes.iter().find_map(|n| match n {
            parser::models::NodeData::Group(g) if g.base.id == *parent_id => Some(g),
            _ => None,
        })
    });

    // Resolve the property
    let value = resolver.resolve_property(property, block, branch_node, group);

    // Get scope chain for display
    let scope_chain = resolver.get_scope_chain_for_property(property, Some(&block.type_));

    println!("Property: {}", property);
    println!("Node: {}", node_id);
    println!("Block: {} (index {})", block.type_, block_index);
    println!("Scope chain: {:?}", scope_chain);

    match value {
        Some(v) => {
            println!("Resolved value: {}", v);
            println!("\nJSON: {}", serde_json::to_string_pretty(&v)?);
        }
        None => {
            println!("Property not found in any scope");
            println!("\nChecked scopes:");
            for scope in scope_chain {
                match scope {
                    scope::config::ScopeLevel::Block => {
                        println!("  - Block: {}", block.extra.contains_key(property));
                    }
                    scope::config::ScopeLevel::Branch => {
                        println!(
                            "  - Branch: {}",
                            branch_node.base.extra.contains_key(property)
                        );
                    }
                    scope::config::ScopeLevel::Group => {
                        if let Some(g) = group {
                            println!("  - Group: {}", g.base.extra.contains_key(property));
                        } else {
                            println!("  - Group: (no parent)");
                        }
                    }
                    scope::config::ScopeLevel::Global => {
                        println!("  - Global: {}", resolver.has_global_property(property));
                    }
                }
            }
        }
    }

    Ok(())
}

fn validate_network(
    path: &str,
    schema_version: &str,
    schemas_dir: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let (network, _validation) = parser::load_network_from_directory(path)?;

    // Create schema registry and load the specified version
    let schemas_path = std::path::PathBuf::from(schemas_dir);
    let mut registry = schema::registry::SchemaRegistry::new(schemas_path);

    match registry.load_library(schema_version) {
        Ok(_) => {}
        Err(e) => {
            eprintln!(
                "Warning: Failed to load schema library '{}': {}",
                schema_version, e
            );
            eprintln!("Available versions: {:?}", registry.list_versions());
            return Err(e);
        }
    }

    let validator = schema::validator::SchemaValidator::new(registry);

    let mut total_issues = 0;
    let mut total_errors = 0;
    let mut total_warnings = 0;

    // Validate all blocks in all branch nodes
    for node in &network.nodes {
        if let parser::models::NodeData::Branch(branch) = node {
            for (idx, block) in branch.blocks.iter().enumerate() {
                let result = validator.validate_block(block, schema_version);

                if result.has_issues() {
                    println!(
                        "\n{}[{}] (block type: {})",
                        branch.base.id, idx, block.type_
                    );

                    for issue in &result.issues {
                        let prefix = match issue.severity {
                            schema::validator::IssueSeverity::Error => {
                                total_errors += 1;
                                "ERROR"
                            }
                            schema::validator::IssueSeverity::Warning => {
                                total_warnings += 1;
                                "WARN"
                            }
                        };

                        if let Some(prop) = &issue.property {
                            println!(
                                "  [{}] {}: {} (property: {})",
                                prefix, issue.message, prop, prop
                            );
                        } else {
                            println!("  [{}] {}", prefix, issue.message);
                        }
                    }

                    total_issues += result.issues.len();
                }
            }
        }
    }

    println!("\n=== Validation Summary ===");
    println!("Schema version: {}", schema_version);
    println!(
        "Total issues: {} ({} errors, {} warnings)",
        total_issues, total_errors, total_warnings
    );

    if total_errors > 0 {
        std::process::exit(1);
    }

    Ok(())
}
