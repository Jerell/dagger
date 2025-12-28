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

Query with unit preferences:

```bash
# Using config defaults (from config.toml)
curl "http://localhost:3000/api/query?q=branch-4/blocks[type=Pipe]/length&network=preset1"

# Override to display length in meters
curl "http://localhost:3000/api/query?q=branch-4/blocks[type=Pipe]/length?units=length:m&network=preset1"

# Override multiple properties
curl "http://localhost:3000/api/query?q=branch-4/blocks[type=Pipe]?units=length:km,diameter:cm&network=preset1"

# Override pressure for compressor blocks
curl "http://localhost:3000/api/query?q=branch-4/blocks[type=Compressor]?units=pressure:bar&network=preset1"

# Combine scope resolution with unit preferences
curl "http://localhost:3000/api/query?q=branch-4/blocks/0/pressure?scope=block,branch,global&units=pressure:bar&network=preset1"
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
curl "http://localhost:3000/api/network/nodes?network=preset1&type=branch"
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
curl "http://localhost:3000/api/schema"
```

Get schemas for a version:

```bash
curl "http://localhost:3000/api/schema/v1.0"
```

Get network schemas (all blocks):

```bash
curl "http://localhost:3000/api/schema/network?network=preset1&version=v1.0"
```

Get block schema properties (by query):

```bash
curl "http://localhost:3000/api/schema/properties?network=preset1&q=branch-4/blocks/2&version=v1.0"
```

Validate blocks by query:

```bash
curl "http://localhost:3000/api/schema/validate?network=preset1&q=branch-4/blocks&version=v1.0"
```

Validate entire network:

```bash
curl "http://localhost:3000/api/schema/network/validate?network=preset1&version=v1.0"
```

Validate a block (POST, without network context):

```bash
curl -X POST http://localhost:3000/api/schema/validate \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1.0",
    "blockType": "Compressor",
    "block": {
      "type": "Compressor",
      "pressure": 15.5
    }
  }'
```

**Note:**

- All schema property endpoints include metadata (`title`, `dimension`, `defaultUnit`) when available in the schema definitions.
- Validation endpoints (GET) include `value` (formatted strings according to unit preferences) and `scope` fields when properties are found via scope resolution.
- Values in validation responses are formatted using unit preferences from config (block-type preferences, dimension-level preferences, or schema defaultUnit).
- Unknown properties are not validated (allows validating subsets of properties with different schemas).
- Validation uses Effect Schema (not Zod) and is performed entirely in TypeScript.
- Schemas are located in `backend/src/schemas/` and organized by version (e.g., `v1.0/`, `v1.0-costing/`).

## Notes

- **Network parameter**: Use network names (e.g., `preset1`) not full paths. The API maps these to `backend/networks/{name}/`
- **Default network**: If `network` parameter is omitted, defaults to `preset1`
- **Schemas**: Schemas are located in `backend/src/schemas/` and organized by version (e.g., `v1.0/`, `v1.0-costing/`). They use Effect Schema (not Zod).
- **WASM module**: Must be built before the API will work (`just build-wasm`)
- **File system access**: WASM runs in a browser-like environment, so file paths are resolved relative to where the Node.js process is running (the backend directory)
- **Setting up networks**: Use `just setup-networks` to copy networks from project root to `backend/networks/`
- **Unit preferences**: Configure defaults in `config.toml` under `[unitPreferences]`, or override per-query using `?units=property:unit` parameter in the query string
- **Combining parameters**: Multiple query parameters can be combined with `&`, e.g., `?scope=block,branch,global&units=pressure:bar`
