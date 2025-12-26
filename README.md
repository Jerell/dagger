# Dagger

A tool for working with file-based directed graphs, designed for modeling and analyzing network structures with hierarchical property inheritance and schema-based validation.

## Overview

Dagger provides a flexible system for defining, querying, and validating network configurations using TOML files. It supports complex property inheritance across scopes, unit-aware value handling, and versioned schema validation for different use cases (e.g., modeling vs. costing calculations).

## Key Features

- **File-based Network Definition**: Define networks using TOML files organized into branches, groups, and global configuration
- **Hierarchical Scope System**: Properties inherit through scopes: `Global > Group > Branch > Block`
- **Query System**: Navigate and extract data using a flexible query syntax with filtering, array indexing, and property access
- **Schema Validation**: Versioned schema registry for validating network configurations against different requirements
- **Unit-Aware**: Automatic unit conversion and normalization using dimensional analysis (via [dim](https://github.com/Jerell/dim) library)
- **CLI & API**: Both command-line interface and REST API for programmatic access
- **WebAssembly Support**: Core functionality compiled to WASM for use in web applications

## Project Structure

```
dagger/
├── cli/              # Rust CLI application
├── backend/          # TypeScript/Node.js API server (Hono)
├── network/          # Example network configurations
└── frontend/         # Frontend application (in development)
```

## Installation

### Prerequisites

- **Rust** (for CLI and WASM compilation)
- **Node.js** (for backend API)
- **just** (optional, for running project commands)

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd dagger
```

2. Install dependencies:

```bash
# Install Rust CLI dependencies (automatic on first build)
cd cli && cargo build

# Install backend dependencies
cd ../backend && npm install
```

3. Build WebAssembly module (required for backend):

```bash
# From project root
just build-wasm
# Or manually:
cd cli && wasm-pack build --target nodejs --out-dir ../backend/pkg
```

4. Setup networks:

```bash
just setup-networks
```

## Quick Start

### CLI Usage

The CLI provides several commands for working with networks:

```bash
# Export network to JSON
dagger export network/preset1

# Query a specific path
dagger query "branch-4/label" network/preset1

# List all nodes
dagger list network/preset1

# Resolve a property value (with scope inheritance)
dagger resolve branch-4 0 ambientTemperature network/preset1
```

### Backend API

Start the development server:

```bash
cd backend && npm run dev
```

The API will be available at `http://localhost:3000`. See [backend/README.md](backend/README.md) for full API documentation.

## Network Structure

Networks are defined using TOML files organized in a directory structure:

```
network-name/
├── config.toml          # Global configuration
├── group-1.toml         # Group definitions
├── branch-1.toml        # Branch definitions
├── branch-2.toml
└── ...
```

### Scope Hierarchy

Properties defined at outer scopes are accessible to inner scopes:

```
Global (config.toml)
  └─> Group (group-*.toml)
       └─> Branch (branch-*.toml)
            └─> Block (within branch)
```

The file names are used as IDs for nodes in the graph. They do not need to say "group-" or "branch-" to be a group or a branch.

### Example Network

**config.toml** (Global scope):

```toml
[properties]
ambientTemperature = "20.0 C"
pressure = 14.7

[inheritance]
general = ["block", "branch", "group", "global"]

[unitPreferences.Pipe]
length = "km"
```

**branch-1.toml** (Branch scope):

```toml
type = "branch"
label = "Branch 1"
parentId = "group-1"

[position]
x = 20
y = 30

[[block]]
type = "Source"
pressure = "100 bar"

[[block]]
type = "Pipe"
length = "1000 m"
```

## Query System

Dagger provides a query syntax for navigating and extracting data from networks. See [QUERY_SYNTAX.md](QUERY_SYNTAX.md) for complete documentation.

### Basic Examples

```bash
# Get node label
dagger query "branch-4/label" network/preset1

# Get all blocks
dagger query "branch-4/blocks" network/preset1

# Filter blocks by type
dagger query "branch-4/blocks[type=Pipe]" network/preset1

# Access nested properties
dagger query "branch-4/blocks/0/pressure" network/preset1

# Array ranges
dagger query "branch-4/blocks/1:3" network/preset1

# Comparison operators
dagger query "branch-4/blocks[pressure>10]" network/preset1
```

### Query Parameters

- **Scope Resolution**: `?scope=block,branch,group,global` - Resolve properties through scope inheritance
- **Unit Preferences**: `?units=length:km,pressure:bar` - Override unit display preferences

## Schema System

Dagger uses versioned schemas to validate network configurations and generate forms. Different schema sets can be used for different purposes:

- **v1.0**: General modeling schemas
- **v1.0-costing**: Costing-specific schemas

Schemas define:

- Required and optional properties for each block type
- Property metadata (dimensions, default units, validation rules)
- Type information for form generation

### Schema API

```bash
# Get all available schema versions
GET /api/schema

# Get schemas for a specific version
GET /api/schema/v1.0

# Get schema properties for a network
GET /api/schema/network?network=preset1&version=v1.0

# Validate network against schemas
GET /api/schema/network/validate?network=preset1&version=v1.0
```

## Scope Resolution

Properties can be resolved through the scope hierarchy. The inheritance rules are defined in `config.toml`:

```toml
[inheritance]
general = ["block", "branch", "group", "global"]

[inheritance.rules]
ambientTemperature = ["group", "global"]
pressure = ["block"]
```

When querying a property, Dagger checks each scope in order until a value is found.

## Unit Preferences

Dagger automatically handles unit conversion and normalization:

1. Values are stored internally in base SI units
2. Unit preferences can be set in `config.toml` per block type
3. Query parameters can override unit preferences
4. Values are converted using dimensional analysis

Example:

```toml
[unitPreferences.Pipe]
length = "km"
diameter = "m"

[unitPreferences.dimensions]
pressure = "bar"
temperature = "°C"
```

## Development

### Project Commands (using `just`)

```bash
# Development
just dev              # Start backend server
just dev-full         # Build WASM and start server

# Building
just build-wasm       # Build WebAssembly module
just build-backend    # Build TypeScript backend

# Testing
just test             # Run all Rust tests
just test-query       # Run query tests
just test-parser      # Run parser tests

# Code Quality
just lint             # Run clippy
just format           # Format Rust code
just check            # Run all checks
```

### Manual Commands

```bash
# Build CLI
cd cli && cargo build --release

# Run tests
cd cli && cargo test

# Start backend
cd backend && npm run dev

# Build WASM
cd cli && wasm-pack build --target nodejs --out-dir ../backend/pkg
```

## Documentation

- [QUERY_SYNTAX.md](QUERY_SYNTAX.md) - Complete query syntax documentation
- [backend/README.md](backend/README.md) - Backend API documentation
- [backend/API_TESTING.md](backend/API_TESTING.md) - API testing examples
- [VALIDATION_COMMANDS.md](VALIDATION_COMMANDS.md) - Validation command reference
