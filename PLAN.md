# Dagger Network Parser & Query System - Implementation Plan

> **Note (January 2026):** This is the original implementation plan for the CLI and backend. For frontend/Tauri implementation details, see [FLOW_NETWORK_SPEC.md](./FLOW_NETWORK_SPEC.md) and [TAURI_DISTRIBUTION_PLAN.md](./TAURI_DISTRIBUTION_PLAN.md).

## Overview

This document outlines the plan for building a TOML-based network configuration system with hierarchical variable scoping, query capabilities, schema generation, and API integration.

## Architecture

### Core Components

1. **Parser Layer** (`cli/src/parser/`)

   - TOML file parsing with dynamic property support
   - Network graph construction
   - Type-safe structs with `HashMap<String, Value>` catch-all

2. **Scope System** (`cli/src/scope/`)

   - Hierarchical variable resolution (Global → Group → Branch → Block)
   - Configurable inheritance rules per property
   - Property metadata registry

3. **Query Engine** (`cli/src/query/`)

   - Path-based query notation
   - JSON output formatting
   - Navigation and inspection utilities

4. **Schema Generator** (`cli/src/schema/`)

   - Block type property definitions
   - Zod schema generation
   - TypeScript type generation (optional)

5. **API Server** (`server/`)

   - Hono-based REST API
   - Zod validation
   - Query endpoint integration

6. **Frontend** (`frontend/`)
   - React Flow visualization (future)
   - Interactive querying
   - Form generation from schemas

---

## Phase 1: Core Data Structures & Parser

### 1.1 TOML Data Models

```rust
// Base node structure with dynamic properties
#[derive(Debug, Deserialize, Serialize)]
struct Node {
    // File-derived ID (from filename: "branch-4.toml" -> "branch-4")
    id: String,

    // Known fields
    #[serde(rename = "type")]
    type_: String,
    label: String,
    position: Position,

    // Optional known fields
    parent_id: Option<String>,
    width: Option<u32>,
    height: Option<u32>,

    // Dynamic properties catch-all
    #[serde(flatten)]
    extra: HashMap<String, Value>,
}

// Branch-specific
#[derive(Debug, Deserialize, Serialize)]
struct BranchNode {
    #[serde(flatten)]
    base: Node,

    #[serde(rename = "outgoing")]
    outgoing: Vec<Outgoing>,

    // TOML uses [[block]] array syntax, but we serialize as "blocks" in JSON
    #[serde(rename = "block", default)]
    blocks: Vec<Block>,
}

// Block structure
// Note: In TOML, blocks are defined as [[block]] arrays for better readability
// In JSON output, they're serialized as "blocks": [...]
#[derive(Debug, Deserialize, Serialize)]
struct Block {
    quantity: Option<u32>,  // Defaults to 1 if missing
    #[serde(rename = "type")]
    type_: String,

    #[serde(flatten)]
    extra: HashMap<String, Value>,
}

// Outgoing connection
#[derive(Debug, Deserialize, Serialize)]
struct Outgoing {
    target: String,
    weight: u32,
}
```

### 1.2 Network Graph Structure

```rust
#[derive(Debug, Serialize)]
struct Network {
    id: String,
    label: String,
    nodes: Vec<NodeData>,
    edges: Vec<Edge>,
}

#[derive(Debug, Serialize)]
enum NodeData {
    Branch(BranchNode),
    Group(GroupNode),
    GeographicAnchor(GeographicAnchorNode),
    GeographicWindow(GeographicWindowNode),
}
```

### 1.3 Parser Implementation

- Scan `network/preset1/` directory for `.toml` files
- Load `config.toml` if present (global properties and inheritance rules)
- Parse each file based on `type` field
- Build network graph with edges from `outgoing` arrays
- **Non-blocking validation**: Flag issues (missing references, invalid properties) but allow network to be inspected
- Collect validation warnings/errors for user feedback

**Validation Result Structure:**

```rust
#[derive(Debug)]
struct ValidationResult {
    errors: Vec<ValidationError>,
    warnings: Vec<ValidationWarning>,
}

#[derive(Debug)]
struct ValidationError {
    severity: ErrorSeverity,
    message: String,
    location: Option<String>,  // e.g., "branch-4/outgoing[0]/target"
}

#[derive(Debug)]
enum ErrorSeverity {
    Error,    // Invalid TOML, type mismatch
    Warning,  // Missing reference, missing property
}
```

**File Structure:**

```
cli/src/
  parser/
    mod.rs
    models.rs          # Serde structs
    network.rs         # Network graph builder
    loader.rs          # File system operations
    validation.rs      # Non-blocking validation (warnings/errors)
```

---

## Phase 2: Scope Inheritance System

### 2.1 Scope Hierarchy

```
Global (preset-level config, if exists)
  └── Group
      └── Branch
          └── Block
```

### 2.2 Inheritance Configuration

Configuration is stored in `network/preset1/config.toml`:

```toml
# Global properties (preset-level defaults)
# These values are used when property is not found in lower scopes
[properties]
ambientTemperature = 20.0
pressure = 14.7

# Inheritance rules
# Default inheritance chain for properties without explicit rules
[inheritance]
general = ["block", "branch", "group", "global"]

# Per-property inheritance rules
[inheritance.rules]
# ambientTemperature inherits from group and global (skips block and branch)
ambientTemperature = ["group", "global"]

# Per-property, per-block-type overrides
[inheritance.rules.pressure]
# Default for pressure property
inheritance = ["block"]
# Override for specific block types
[inheritance.rules.pressure.overrides]
Pipe = ["branch", "group"]
Compressor = ["block"]
```

**Rust Structure:**

```rust
#[derive(Debug, Clone, Deserialize)]
struct Config {
    // Global property defaults
    #[serde(default)]
    properties: HashMap<String, toml::Value>,

    // Inheritance configuration
    #[serde(default)]
    inheritance: InheritanceConfig,
}

#[derive(Debug, Clone, Deserialize)]
struct InheritanceConfig {
    // Default inheritance chain for properties without explicit rules
    #[serde(default = "default_general_inheritance")]
    general: Vec<ScopeLevel>,

    // Per-property inheritance rules
    #[serde(default)]
    rules: HashMap<String, PropertyInheritanceRule>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum PropertyInheritanceRule {
    // Simple: just a list of scopes
    Simple(Vec<ScopeLevel>),
    // Complex: with per-block-type overrides
    Complex {
        inheritance: Vec<ScopeLevel>,
        #[serde(default)]
        overrides: HashMap<String, Vec<ScopeLevel>>,
    },
}

fn default_general_inheritance() -> Vec<ScopeLevel> {
    vec![ScopeLevel::Block, ScopeLevel::Branch, ScopeLevel::Group, ScopeLevel::Global]
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
enum ScopeLevel {
    Global,
    Group,
    Branch,
    Block,
}
```

### 2.3 Resolution Engine

```rust
struct ScopeResolver {
    config: Config,
}

impl ScopeResolver {
    fn new(config: Config) -> Self {
        Self { config }
    }

    fn resolve_property(
        &self,
        property: &str,
        block: &Block,
        branch: &BranchNode,
        group: Option<&GroupNode>,
        global: Option<&Config>,
    ) -> Option<Value> {
        let scope_chain = self.get_scope_chain(property, &block.type_);

        // Walk up the chain until value found
        for scope in scope_chain {
            match scope {
                ScopeLevel::Block => {
                    if let Some(v) = block.extra.get(property) {
                        return Some(v.clone());
                    }
                }
                ScopeLevel::Branch => {
                    if let Some(v) = branch.extra.get(property) {
                        return Some(v.clone());
                    }
                }
                ScopeLevel::Group => {
                    if let Some(v) = group.and_then(|g| g.extra.get(property)) {
                        return Some(v.clone());
                    }
                }
                ScopeLevel::Global => {
                    // Check config.toml [properties] section
                    if let Some(v) = global.and_then(|g| g.properties.get(property)) {
                        return Some(v.clone());
                    }
                }
            }
        }
        None
    }

    fn get_scope_chain(&self, property: &str, block_type: &str) -> Vec<ScopeLevel> {
        // Get inheritance rule for property, or use general default
        let rule = self.config.inheritance.rules.get(property)
            .map(|r| match r {
                PropertyInheritanceRule::Simple(scopes) => scopes.clone(),
                PropertyInheritanceRule::Complex { inheritance, overrides } => {
                    // Check for block-type override
                    overrides.get(block_type)
                        .cloned()
                        .unwrap_or_else(|| inheritance.clone())
                }
            })
            .unwrap_or_else(|| self.config.inheritance.general.clone());

        rule
    }
}
        }
        None
    }
}
```

**File Structure:**

```
cli/src/
  scope/
    mod.rs
    config.rs          # PropertyConfig definitions
    resolver.rs        # Resolution logic
    registry.rs        # Property registry management
```

---

## Phase 3: Query System & Path Notation

### 3.1 Path Notation Design

**Primary Syntax (URL-like, maps well to Hono API):**

```
# Node by ID
branch-4

# Nested property access
branch-4/label
branch-4/position/x
branch-4/blocks/0/type
branch-4/blocks/0/quantity

# Query with filters
branch-4/blocks[type=Compressor]
branch-4/blocks[type=Compressor]/0/pressure

# Scope resolution queries
branch-4/blocks/0/ambientTemperature?scope=block,branch,group

# Edge queries
branch-4/outgoing
branch-4/outgoing/target
branch-4/outgoing[weight>1]

# Network-level queries
nodes[type=branch]
edges[source=branch-1]
```

**Future Extension: JSONPath Support**

JSONPath can be added later as an alternative query syntax for complex queries:

```
$.nodes[id="branch-4"]
$.nodes[id="branch-4"].blocks[0].type
$.nodes[id="branch-4"].blocks[type="Compressor"]
```

**Recommendation:** Start with URL-like path notation, add JSONPath support later if needed.

### 3.2 Query Parser

```rust
#[derive(Debug)]
enum QueryPath {
    Node(String),                           // "branch-4"
    Property(String, Box<QueryPath>),       // "branch-4/label"
    Index(usize, Box<QueryPath>),          // "branch-4/blocks/0"
    Filter(String, String, Box<QueryPath>), // "branch-4/blocks[type=Compressor]"
    ScopeResolve(String, Vec<ScopeLevel>),  // "branch-4/blocks/0/ambientTemperature?scope=block,branch"
}
```

### 3.3 CLI Commands

```bash
# List all nodes
dagger list nodes

# Query specific path
dagger query branch-4/label
dagger query branch-4/blocks/0/type

# Output full network as JSON
dagger export --format json

# Interactive navigation
dagger explore

# Scope resolution
dagger resolve branch-4/blocks/0/ambientTemperature
```

**File Structure:**

```
cli/src/
  query/
    mod.rs
    parser.rs          # Path parsing
    executor.rs        # Query execution
    formatter.rs       # JSON output formatting
  commands/
    mod.rs
    list.rs
    query.rs
    export.rs
    explore.rs
    resolve.rs
```

---

## Phase 4: Versioned Schema Libraries

### 4.1 Schema Library Structure

Schema libraries are versioned collections of Zod schemas that define required/optional properties for block types. Each library version can evolve independently.

**Library Structure:**

```
schemas/
  v1.0/
    compressor.ts
    pipe.ts
    source.ts
    sink.ts
  v1.1/
    compressor.ts    # Updated: no longer requires z, now requires w
    pipe.ts
    source.ts
    sink.ts
  v1.2/
    compressor.ts
    pipe.ts
    source.ts
    sink.ts
    index.ts         # Exports all schemas for this version
```

**Example Schema (v1.1/compressor.ts):**

```typescript
import { z } from "zod";

export const CompressorSchema = z.object({
  type: z.literal("Compressor"),
  quantity: z.number().optional().default(1),

  // Required properties (v1.1)
  pressure: z.number().min(0).describe("Operating pressure in PSI"),
  x: z.number().describe("X coordinate"),
  y: z.number().describe("Y coordinate"),
  w: z.number().min(0).describe("Width (new in v1.1)"),

  // Optional properties
  efficiency: z.number().min(0).max(1).default(0.85).optional(),
});
```

**Schema Registry:**

```rust
#[derive(Debug, Clone)]
struct SchemaLibrary {
    version: String,
    schemas: HashMap<String, String>,  // block_type -> Zod schema code
}

// Load schemas from TypeScript files
// Parse and validate Zod schemas
// Provide schema lookup by version and block type
```

### 4.2 Schema Loading & Validation

- Load schema libraries from `schemas/` directory
- Parse TypeScript/Zod files (or use pre-compiled JSON representations)
- Validate block instances against schemas
- Report missing required properties, type mismatches, etc.

**File Structure:**

```
cli/src/
  schema/
    mod.rs
    loader.rs          # Load schema libraries from filesystem
    registry.rs        # Schema version registry
    validator.rs       # Validate blocks against schemas
schemas/               # Schema library directory
  v1.0/
    *.ts
  v1.1/
    *.ts
```

---

## Phase 5: Hono API Server

### 5.1 Server Structure

```
server/
  src/
    main.ts
    routes/
      query.ts         # Query endpoints
      network.ts       # Network CRUD
      schema.ts        # Schema endpoints (load versioned libraries)
      scope.ts         # Scope resolution
    lib/
      network.ts       # Network loading/querying (WASM bindings)
      validation.ts    # Zod schemas from versioned libraries
    types/
      network.ts
  pkg/                 # Generated WASM package from Rust
    dagger_core_bg.wasm
    dagger_core.js
    dagger_core.d.ts
```

### 5.2 API Endpoints

```typescript
// Query network
GET /api/query?path=branch-4/label
GET /api/query?path=branch-4/blocks/0/type

// Get full network
GET /api/network

// Scope resolution
POST /api/scope/resolve
{
  "nodeId": "branch-4",
  "blockIndex": 0,
  "property": "ambientTemperature"
}

// Get schema for block type (from versioned library)
GET /api/schema/:version/block/:type
// Returns Zod schema JSON from specified version

// List available schema versions
GET /api/schema/versions

// Update node/block property
PUT /api/nodes/:id
PUT /api/nodes/:id/blocks/:index
```

### 5.3 Rust Integration via WebAssembly

**Primary Approach: wasm-bindgen**

- Compile Rust core as WebAssembly library
- Use `wasm-bindgen` to expose Rust functions to JavaScript/TypeScript
- Pros: Reuse Rust code, good performance, type-safe bindings
- Cons: Build setup complexity, WASM bundle size

**Implementation:**

```rust
// cli/src/lib.rs (compiled to WASM)
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Network {
    inner: network::Network,
}

#[wasm_bindgen]
impl Network {
    #[wasm_bindgen(constructor)]
    pub fn new(toml_files: &str) -> Result<Network, JsValue> {
        // Parse TOML files and build network
    }

    #[wasm_bindgen]
    pub fn query(&self, path: &str) -> Result<JsValue, JsValue> {
        // Execute query and return JSON
    }
}
```

**Server Integration:**

```typescript
// server/src/lib/network.ts
import init, { Network } from "@dagger/core";

await init(); // Initialize WASM module

export async function loadNetwork(presetPath: string): Promise<Network> {
  const tomlFiles = await loadTomlFiles(presetPath);
  return new Network(tomlFiles);
}
```

**Build Setup:**

- Add `wasm-bindgen` and `wasm-pack` dependencies
- Configure Cargo for WASM target
- Build script generates npm package with WASM bindings

---

## Phase 6: Frontend (Future)

### 6.1 React Flow Integration

- Load network from API
- Render nodes and edges
- Interactive property editing
- Scope visualization
- Query interface

### 6.2 Form Generation

- Use generated Zod schemas
- React Hook Form + Zod resolver
- Dynamic form fields based on block type
- Scope-aware property inputs

---

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE

- [x] Core data structures with serde
- [x] TOML parser for all node types
- [x] Network graph builder
- [x] Basic CLI structure
- [x] Non-blocking validation system

### Phase 2: Scope System ✅ COMPLETE

- [x] Property configuration system
- [x] Scope resolver implementation
- [x] Inheritance rule engine
- [x] CLI resolve command
- [ ] Tests for scope resolution

### Phase 3: Query System ✅ COMPLETE

- [x] Path notation parser (basic)
- [x] Query executor (basic)
- [x] JSON formatter
- [x] CLI commands (list, query, export)
- [x] Filter support (`blocks[label=Pipe]`, `blocks[quantity>1]`)
- [x] Filter operators (=, !=, >, <, >=, <=)
- [x] Scope resolution query parser (`?scope=block,branch,group`)
- [x] Full scope resolution in queries (with block context tracking)
- [x] Network-level queries (`nodes[type=branch]`, `edges[source=branch-1]`)
- [x] Comprehensive tests for query system (16 tests)
- [x] Tests for scope resolution (block, global, not found)
- [x] Tests for network-level queries (nodes, edges, with filters)
- [x] Query syntax documentation (QUERY_SYNTAX.md)

### Phase 4: Versioned Schema Libraries ✅ COMPLETE

- [x] Schema library structure and versioning
- [x] Schema loader (read JSON generated from TypeScript/Zod files)
- [x] Schema registry (version management)
- [x] Block validation against schemas
- [x] CLI validate command
- [x] Schema API endpoints (Phase 5)

### Phase 5: API Server ✅ COMPLETE

- [x] Hono server setup
- [x] Query endpoints (WASM integrated)
- [x] Network endpoints (WASM integrated)
- [x] Schema endpoints (WASM integrated)
- [x] Rust WASM compilation setup
- [x] wasm-bindgen integration
- [x] WASM package build and import
- [x] Justfile with development commands
- [ ] Test API endpoints end-to-end
- [ ] Handle file system access in WASM (may need path adjustments)

### Phase 6: Frontend ✅ COMPLETE

- [x] React Flow setup (ReactFlow with custom node types)
- [x] Network visualization (interactive editor with drag/connect)
- [x] Tauri desktop app with native file system access
- [x] File watching and TOML export
- [ ] Query interface (not yet exposed in UI)
- [ ] Form generation (not yet implemented)

---

## Recommendations & Considerations

### 1. Path Notation

**Recommendation:** Start simple, extend later

- Initial: `node-id/property/nested`
- Add filters: `node-id/blocks[type=Compressor]`
- Add scope queries: `?scope=block,branch,group`

**Alternative:** Consider JSONPath if you need complex queries later, but it's overkill initially.

### 2. Scope Configuration

**Implementation:** Use `config.toml` in network directory

```toml
# Global property defaults
[properties]
ambientTemperature = 20.0
pressure = 14.7

# Inheritance rules
[inheritance]
general = ["block", "branch", "group", "global"]
ambientTemperature = ["group", "global"]
pressure = ["block"]
```

This allows users to configure inheritance and defaults without code changes.

### 3. Rust vs TypeScript

**Implementation:**

- Keep core parsing/querying in Rust (performance, type safety)
- Use TypeScript for API server (ecosystem, faster iteration)
- Bridge via WebAssembly (wasm-bindgen) for seamless integration
- Compile Rust to WASM library, import in TypeScript

### 4. Data Structure Flexibility

**Recommendation:**

- Use `#[serde(flatten)]` with `HashMap<String, Value>` for all node types
- Define known fields explicitly for type safety
- Store unknown fields in `extra` map
- This gives you JavaScript-like flexibility where needed

### 5. Global Configuration

**Implementation:** Use `config.toml` in network directory (`network/preset1/config.toml`)

```toml
# Global property defaults (preset-level)
[properties]
ambientTemperature = 20.0
pressure = 14.7

# Inheritance configuration
[inheritance]
general = ["block", "branch", "group", "global"]
ambientTemperature = ["group", "global"]
```

This file also contains inheritance rules (see Section 2.2).

### 6. Validation

**Approach: Non-blocking validation with warnings/errors**

- **Parser validation**: Validate TOML structure on load (syntax, types)
  - Errors: Invalid TOML syntax, type mismatches
  - Warnings: Missing optional fields, unexpected types
- **Reference validation**: Check that references exist
  - Warnings: `parent_id` points to non-existent node
  - Warnings: `outgoing.target` points to non-existent node
  - Network still loads, but issues are flagged
- **Schema validation**: Validate blocks against versioned schemas
  - Warnings: Missing required properties (per schema version)
  - Warnings: Type mismatches
  - Errors: Invalid property values (if schema defines constraints)
- **Scope resolution**: Validate property types when resolving
  - Warnings: Property found but type doesn't match expected type
- **API validation**: Use Zod schemas for API input validation
  - Reject invalid requests at API boundary

### 7. Performance

**Considerations:**

- Network graphs might be large (100+ nodes)
- Scope resolution could be called frequently
- Cache resolved values if same queries repeated
- Consider indexing nodes by ID for O(1) lookup

### 8. Error Handling

**Recommendation:**

- Use `Result` types throughout
- Provide clear error messages for:
  - Missing files
  - Invalid TOML
  - Missing references
  - Query path errors
  - Scope resolution failures

### 9. Testing Strategy

- Unit tests for parsers
- Unit tests for scope resolution
- Integration tests for query system
- Test fixtures with sample TOML files

### 10. Documentation

- Document path notation syntax
- Document scope inheritance rules
- Document block type schemas
- API documentation (OpenAPI/Swagger)

---

## File Structure Summary

```
dagger/
├── cli/                      # Rust CLI (WASM-compiled for backend)
│   └── src/
│       ├── main.rs
│       ├── lib.rs            # WASM entry point
│       ├── parser/
│       ├── scope/
│       ├── query/
│       ├── schema/
│       └── dim/              # Dimensional analysis
├── backend/                  # Local server (Bun + Hono)
│   └── src/
│       ├── index.ts
│       ├── routes/
│       │   ├── network.ts
│       │   ├── query.ts
│       │   └── schema.ts
│       ├── schemas/          # Versioned schema libraries
│       │   ├── v1.0/
│       │   └── v1.0-costing/
│       └── services/
├── frontend/                 # React + Tauri app
│   ├── src/
│   │   ├── components/
│   │   │   └── flow/         # ReactFlow components
│   │   ├── lib/
│   │   │   ├── tauri.ts      # Tauri API wrapper
│   │   │   ├── collections/  # tanstack-db collections
│   │   │   └── hooks/
│   │   └── routes/
│   └── src-tauri/            # Tauri backend (Rust)
│       └── src/
│           ├── lib.rs        # App setup, auto-start server
│           ├── commands.rs   # Tauri commands
│           ├── file_watcher.rs
│           └── server.rs     # Local server management
└── network/
    └── preset1/
        ├── config.toml       # Global properties and inheritance rules
        └── *.toml
```

---

## Next Steps

1. **Start with Phase 1**: Build core parser and data structures
2. **Validate approach**: Parse existing TOML files, verify structure matches example.json
3. **Iterate**: Add scope system, then query system, then API
4. **Test early**: Write tests as you build each component
5. **Document**: Keep this plan updated as you discover new requirements

---

## Decisions Made

1. **TOML vs JSON naming**: Keep `[[block]]` in TOML (more intuitive), serialize as `blocks` in JSON
2. **Validation approach**: Non-blocking - flag issues but allow network inspection
3. **Global config**: `config.toml` in network directory with `[properties]` section (no "default" prefix)
4. **Query syntax**: URL-like path notation (primary), JSONPath as future extension
5. **Rust integration**: WebAssembly via wasm-bindgen (first choice)
6. **Schema libraries**: Versioned TypeScript/Zod schema files in `schemas/` directory

## Questions to Resolve

1. **API authentication**: Will the API need auth/authorization?
2. **Real-time updates**: Should the API support WebSocket for live updates?
3. **Persistence**: How are property updates persisted? (Write back to TOML? Database?)
4. **Schema version selection**: How to specify which schema version to use? (Config file, API parameter, auto-detect?)
