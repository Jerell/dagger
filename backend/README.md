# Dagger Backend API

Hono-based API server for the Dagger network inspection tool.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

The server will start on `http://localhost:3000` by default.

## API Endpoints

### Health Check

- `GET /health` - Health check endpoint

### Query API

- `GET /api/query?q=<query>&network=<path>` - Execute a query on the network

### Network API

- `GET /api/network?network=<path>` - Get full network structure
- `GET /api/network/nodes?network=<path>&type=<type>` - Get all nodes (optionally filtered by type)
- `GET /api/network/edges?network=<path>&source=<id>&target=<id>` - Get all edges (optionally filtered)

### Schema API

- `GET /api/schema` - Get all available schema versions
- `GET /api/schema/:version` - Get schemas for a specific version
- `GET /api/schema/network?network=<name>&version=<version>` - Get schema properties for all blocks in a network (flattened format)
- `GET /api/schema/properties?network=<name>&q=<query>&version=<version>` - Get schema properties for blocks matching a query path
- `GET /api/schema/validate?network=<name>&q=<query>&version=<version>` - Validate blocks matching a query path
- `GET /api/schema/network/validate?network=<name>&version=<version>` - Validate all blocks in a network
- `POST /api/schema/validate` - Validate a block against a schema (without network context)

## WebAssembly Integration

The backend will use WebAssembly bindings from the Rust CLI code. To build the WASM package:

```bash
just build-wasm
```

This compiles the Rust code in `../cli` to WebAssembly and outputs it to `./pkg`.

### Operations API

#### Costing

- `POST /api/operations/costing/estimate` - Run a costing estimate for a network
- `POST /api/operations/costing/validate` - Validate a network for costing readiness
- `GET /api/operations/costing/libraries` - List available cost libraries
- `GET /api/operations/costing/libraries/:id` - Get details about a specific cost library
- `GET /api/operations/costing/libraries/:id/modules?type=<type>` - List modules in a cost library (optionally filtered by type)
- `GET /api/operations/costing/health` - Check if the costing server is reachable

#### Snapshot

- `POST /api/operations/snapshot/validate` - Validate a network for snapshot readiness
- `POST /api/operations/snapshot/run` - Run a snapshot simulation
- `POST /api/operations/snapshot/raw` - Pass through a raw ScenarioRequest to the Scenario Modeller API
- `GET /api/operations/snapshot/health` - Check if the Scenario Modeller server is reachable

## Networks Directory

Networks are stored in `backend/networks/`. You can:

- Copy networks from the project root: `cp -r ../network/preset1 ./networks/`
- Create symlinks: `ln -s ../network/preset1 ./networks/preset1`
- Create new networks directly in `networks/`

The API uses network names (e.g., `preset1`) which map to `networks/preset1/`.

## Environment Variables

- `PORT` - Server port (default: 3000)
