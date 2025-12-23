use clap::{Parser, Subcommand};
use dagger::parser;
use serde_json;

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

fn query_network(path: &str, query: &str) -> Result<(), Box<dyn std::error::Error>> {
    // TODO: Implement query parser and executor (Phase 3)
    eprintln!("Query functionality not yet implemented. Query: {}", query);
    eprintln!("Network loaded from: {}", path);
    Ok(())
}
