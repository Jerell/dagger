# API Testing Guide

## Prerequisites

1. Build the WASM module:

   ```bash
   just build-wasm
   ```

2. Start the development server:
   ```bash
   just dev-backend
   ```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{ "status": "ok", "service": "dagger-api" }
```

### Query API

Query the network (uses `backend/networks/preset1`):

```bash
curl "http://localhost:3000/api/query?q=branch-4&network=preset1"
```

Query with filters:

```bash
curl "http://localhost:3000/api/query?q=branch-4/data/blocks[type=Pipe]&network=preset1"
```

Query with scope resolution:

```bash
curl "http://localhost:3000/api/query?q=branch-4/data/blocks/0/pressure?scope=block,branch,global&network=preset1"
```

### Network API

Get full network:

```bash
curl "http://localhost:3000/api/network?network=preset1"
```

Get all nodes:

```bash
curl "http://localhost:3000/api/network/nodes?network=preset1"
```

Get nodes by type:

```bash
curl "http://localhost:3000/api/network/nodes?network=preset1&type=branchNode"
```

Get all edges:

```bash
curl "http://localhost:3000/api/network/edges?network=preset1"
```

Get edges by source:

```bash
curl "http://localhost:3000/api/network/edges?network=preset1&source=branch-1"
```

### Schema API

Get all schema versions:

```bash
curl "http://localhost:3000/api/schema?schemasDir=../schemas"
```

Get schemas for a version:

```bash
curl "http://localhost:3000/api/schema/v1.0?schemasDir=../schemas"
```

Validate a block:

```bash
curl -X POST http://localhost:3000/api/schema/validate \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1.0",
    "blockType": "Compressor",
    "block": {
      "type": "Compressor",
      "pressure": 15.5
    },
    "schemasDir": "../schemas"
  }'
```

## Notes

- **Network parameter**: Use network names (e.g., `preset1`) not full paths. The API maps these to `backend/networks/{name}/`
- **Default network**: If `network` parameter is omitted, defaults to `preset1`
- **Schemas directory**: The `schemasDir` parameter defaults to `../schemas` (relative to backend directory)
- **WASM module**: Must be built before the API will work (`just build-wasm`)
- **File system access**: WASM runs in a browser-like environment, so file paths are resolved relative to where the Node.js process is running (the backend directory)
- **Setting up networks**: Use `just setup-networks` to copy networks from project root to `backend/networks/`
