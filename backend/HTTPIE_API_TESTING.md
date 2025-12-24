# HTTPie API Testing Guide

This guide provides HTTPie commands for testing all Dagger API endpoints.

## Prerequisites

- HTTPie installed (`brew install httpie` or `pip install httpie`)
- Backend server running (`just dev-backend` or `cd backend && npm run dev`)
- Network data available in `backend/networks/` (use `just setup-networks`)

## Base URL

All examples assume the server is running on `localhost:3000`.

## Health Check

```bash
# Basic health check
http GET localhost:3000/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "service": "dagger-api"
}
```

## Query API

### Basic Query

Query a specific node:

```bash
http GET localhost:3000/api/query q==branch-4 network==preset1
```

Query with nested path:

```bash
http GET localhost:3000/api/query q=="branch-4/data/blocks" network==preset1
```

Query with array index:

```bash
http GET localhost:3000/api/query q=="branch-4/data/blocks/0" network==preset1
```

### Filtered Queries

Filter blocks by type:

```bash
http GET localhost:3000/api/query q=="branch-4/data/blocks[type=Pipe]" network==preset1
```

Filter blocks by multiple conditions:

```bash
http GET localhost:3000/api/query q=="branch-4/data/blocks[type=Pipe][quantity=1]" network==preset1
```

### Scope Resolution Queries

Query with scope resolution:

```bash
http GET localhost:3000/api/query q=="branch-4/data/blocks/0/pressure?scope=block,branch,global" network==preset1
```

Query with all scope levels:

```bash
http GET localhost:3000/api/query q=="branch-4/data/blocks/0/ambientTemperature?scope=block,branch,group,global" network==preset1
```

### Network-Level Queries

Query all nodes:

```bash
http GET localhost:3000/api/query q==nodes network==preset1
```

Query nodes filtered by type:

```bash
http GET localhost:3000/api/query q=="nodes[type=branchNode]" network==preset1
```

Query all edges:

```bash
http GET localhost:3000/api/query q==edges network==preset1
```

Query edges filtered by source:

```bash
http GET localhost:3000/api/query q=="edges[source=branch-1]" network==preset1
```

Query edges filtered by target:

```bash
http GET localhost:3000/api/query q=="edges[target=branch-2]" network==preset1
```

## Network API

### Get Full Network

```bash
http GET localhost:3000/api/network network==preset1
```

**Response includes:**

- Network metadata (id, label)
- All nodes (branch nodes, group nodes, geographic nodes)
- All edges (connections between nodes)

### Get All Nodes

```bash
http GET localhost:3000/api/network/nodes network==preset1
```

### Get Nodes by Type

Filter by branch nodes:

```bash
http GET localhost:3000/api/network/nodes network==preset1 type==branchNode
```

Filter by group nodes:

```bash
http GET localhost:3000/api/network/nodes network==preset1 type==labeledGroupNode
```

Filter by geographic anchor nodes:

```bash
http GET localhost:3000/api/network/nodes network==preset1 type==geographicAnchorNode
```

Filter by geographic window nodes:

```bash
http GET localhost:3000/api/network/nodes network==preset1 type==geographicWindowNode
```

### Get All Edges

```bash
http GET localhost:3000/api/network/edges network==preset1
```

### Get Edges by Source

```bash
http GET localhost:3000/api/network/edges network==preset1 source==branch-1
```

### Get Edges by Target

```bash
http GET localhost:3000/api/network/edges network==preset1 target==branch-2
```

### Get Edges by Source and Target

```bash
http GET localhost:3000/api/network/edges network==preset1 source==branch-1 target==branch-2
```

## Schema API

### Get All Schema Versions

```bash
http GET localhost:3000/api/schema schemasDir==../schemas
```

**Expected Response:**

```json
["v1.0", "v1.1"]
```

### Get Schemas for a Version

```bash
http GET localhost:3000/api/schema/v1.0 schemasDir==../schemas
```

**Expected Response:**

```json
{
  "Compressor": {
    "type": "object",
    "properties": {
      "pressure": { "type": "number" },
      "temperature": { "type": "number" }
    },
    "required": ["pressure"]
  },
  "Pipe": {
    "type": "object",
    "properties": {
      "length": { "type": "number" },
      "diameter": { "type": "number" }
    },
    "required": ["length"]
  }
}
```

### Validate a Block

Validate a compressor block:

```bash
http POST localhost:3000/api/schema/validate \
  version==v1.0 \
  blockType==Compressor \
  block:='{"type":"Compressor","pressure":15.5}' \
  schemasDir==../schemas
```

Validate with missing required field:

```bash
http POST localhost:3000/api/schema/validate \
  version==v1.0 \
  blockType==Compressor \
  block:='{"type":"Compressor"}' \
  schemasDir==../schemas
```

**Expected Response (validation error):**

```json
{
  "valid": false,
  "errors": [
    {
      "field": "pressure",
      "message": "Required field missing"
    }
  ]
}
```

## Tips and Tricks

### Pretty Print JSON

HTTPie automatically pretty-prints JSON responses. For more control:

```bash
# Use jq for advanced formatting
http GET localhost:3000/api/network network==preset1 | jq '.nodes[0]'
```

### Save Responses to File

```bash
http GET localhost:3000/api/network network==preset1 > network.json
```

### Verbose Output

See request and response headers:

```bash
http -v GET localhost:3000/api/query q==branch-4 network==preset1
```

### Include Custom Headers

```bash
http GET localhost:3000/api/network network==preset1 \
  X-Custom-Header:value
```

### Follow Redirects

```bash
http --follow GET localhost:3000/api/network network==preset1
```

### Timeout Settings

```bash
http --timeout=30 GET localhost:3000/api/network network==preset1
```

## Common Query Patterns

### Get All Blocks in a Branch

```bash
http GET localhost:3000/api/query q=="branch-4/data/blocks" network==preset1
```

### Get Specific Block Property

```bash
http GET localhost:3000/api/query q=="branch-4/data/blocks/0/type" network==preset1
```

### Get All Branch Nodes

```bash
http GET localhost:3000/api/query q=="nodes[type=branchNode]" network==preset1
```

### Get Edges from a Specific Source

```bash
http GET localhost:3000/api/query q=="edges[source=branch-1]" network==preset1
```

### Get Node with Scope Resolution

```bash
http GET localhost:3000/api/query q=="branch-4/data/blocks/0/pressure?scope=block,branch,global" network==preset1
```

## Error Handling

### Invalid Query Path

```bash
http GET localhost:3000/api/query q=="invalid-path" network==preset1
```

**Expected Response:**

```json
{
  "error": "Query failed",
  "message": "Failed to parse query: ..."
}
```

### Missing Network

```bash
http GET localhost:3000/api/query q==branch-4 network==nonexistent
```

**Expected Response:**

```json
{
  "error": "Query failed",
  "message": "Failed to load network: ..."
}
```

### Invalid Network Parameter

```bash
http GET localhost:3000/api/network
```

**Expected Response:**

```json
{
  "error": "Missing required parameter: network"
}
```

## Testing Workflow

1. **Start the server:**

   ```bash
   just dev-backend
   ```

2. **Verify health:**

   ```bash
   http GET localhost:3000/health
   ```

3. **Test basic queries:**

   ```bash
   http GET localhost:3000/api/query q==branch-4 network==preset1
   ```

4. **Test network endpoints:**

   ```bash
   http GET localhost:3000/api/network network==preset1
   http GET localhost:3000/api/network/nodes network==preset1
   ```

5. **Test filtered queries:**

   ```bash
   http GET localhost:3000/api/query q=="nodes[type=branchNode]" network==preset1
   ```

6. **Test scope resolution:**
   ```bash
   http GET localhost:3000/api/query q=="branch-4/data/blocks/0/pressure?scope=block,branch,global" network==preset1
   ```

## Notes

- **Query parameter syntax**: Use `==` for query parameters in HTTPie
- **String values with special characters**: Wrap in quotes, e.g., `q=="branch-4/data/blocks[type=Pipe]"`
- **JSON in POST requests**: Use `:=` for JSON values, e.g., `block:='{"type":"Compressor","pressure":15.5}'`
- **Network names**: Use network names (e.g., `preset1`) not full paths
- **Default network**: If `network` parameter is omitted, it may default to `preset1` (check route implementation)
- **Schemas directory**: The `schemasDir` parameter defaults to `../schemas` (relative to backend directory)
