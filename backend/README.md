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

- `GET /api/schema?schemasDir=<path>` - Get all available schema versions
- `GET /api/schema/:version?schemasDir=<path>` - Get schemas for a specific version
- `POST /api/schema/validate` - Validate a block against a schema

## WebAssembly Integration

The backend will use WebAssembly bindings from the Rust CLI code. To build the WASM package:

```bash
npm run build:wasm
```

This compiles the Rust code in `../cli` to WebAssembly and outputs it to `./pkg`.

## Environment Variables

- `PORT` - Server port (default: 3000)
