use clap::{Parser, Subcommand};
use dagger::parser;
use dagger::query;
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
        #[arg(default_value = "network/preset1")]
        path: String,

        /// Output file (default: stdout)
        #[arg(short, long)]
        output: Option<String>,
    },

    /// List all nodes in the network
    List {
        /// Network directory path
        #[arg(default_value = "network/preset1")]
        path: String,
    },

    /// Query a specific path in the network
    Query {
        /// Query path (e.g., "branch-4/label")
        query: String,

        /// Network directory path
        #[arg(default_value = "network/preset1")]
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
        #[arg(default_value = "network/preset1")]
        path: String,
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

    // Execute the query
    let executor = query::executor::QueryExecutor::new(&network);
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
