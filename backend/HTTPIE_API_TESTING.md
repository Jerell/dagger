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
http GET localhost:3000/api/query q=="branch-4/blocks" network==preset1
```

Query with array index:

```bash
http GET localhost:3000/api/query q=="branch-4/blocks/0" network==preset1
```

Query with array range:

```bash
# Get blocks from index 1 to 2 (inclusive)
http GET localhost:3000/api/query q=="branch-4/blocks/1:2" network==preset1

# Get blocks from start to index 2 (inclusive)
http GET localhost:3000/api/query q=="branch-4/blocks/:2" network==preset1

# Get blocks from index 1 to end
http GET localhost:3000/api/query q=="branch-4/blocks/1:" network==preset1
```

**Order matters when combining ranges with filters:**

```bash
# Filter first, then range: filters all blocks, then takes range from filtered result
http GET localhost:3000/api/query q=="branch-4/blocks[type=Pipe]/1:2" network==preset1

# Range first, then filter: takes range first, then filters those results
http GET localhost:3000/api/query q=="branch-4/blocks/1:2[type=Pipe]" network==preset1
```

### Filtered Queries

Filter blocks by type:

```bash
http GET localhost:3000/api/query q=="branch-4/blocks[type=Pipe]" network==preset1
```

Filter blocks by multiple conditions:

```bash
http GET localhost:3000/api/query q=="branch-4/blocks[type=Pipe][quantity=1]" network==preset1
```

### Scope Resolution Queries

Query with scope resolution:

```bash
http GET localhost:3000/api/query q=="branch-4/blocks/0/pressure?scope=block,branch,global" network==preset1
```

Query with all scope levels:

```bash
http GET localhost:3000/api/query q=="branch-4/blocks/0/ambientTemperature?scope=block,branch,group,global" network==preset1
```

### Unit Preferences Queries

Query with unit preferences (using config defaults):

```bash
# Get pipe length in preferred units from config.toml
http GET localhost:3000/api/query q=="branch-4/blocks[type=Pipe]/length" network==preset1
```

Query with unit override via query parameter:

```bash
# Override to display length in meters
http GET localhost:3000/api/query q=="branch-4/blocks[type=Pipe]/length?units=length:m" network==preset1

# Override multiple properties
http GET localhost:3000/api/query q=="branch-4/blocks[type=Pipe]?units=length:km,diameter:cm" network==preset1

# Override pressure for compressor blocks
http GET localhost:3000/api/query q=="branch-4/blocks[type=Compressor]?units=pressure:bar" network==preset1
```

**Note:** Unit preferences can be combined with scope resolution:

```bash
# Combine scope resolution with unit preferences
http GET localhost:3000/api/query q=="branch-4/blocks/0/pressure?scope=block,branch,global&units=pressure:bar" network==preset1
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

### Get Network Schemas

Get schema properties for all blocks in a network. Returns the same flattened format as `/api/schema/properties` but for every block across all branches:

```bash
http GET localhost:3000/api/schema/network network==preset1 version==v1.0
```

**Expected Response:**

```json
{
  "branch-1/blocks/0/length": {
    "block_type": "Pipe",
    "property": "length",
    "required": false,
    "title": "Length",
    "dimension": "length",
    "defaultUnit": "m"
  },
  "branch-1/blocks/0/diameter": {
    "block_type": "Pipe",
    "property": "diameter",
    "required": false,
    "title": "Diameter",
    "dimension": "length",
    "defaultUnit": "m"
  },
  "branch-1/blocks/1/pressure": {
    "block_type": "Compressor",
    "property": "pressure",
    "required": true,
    "title": "Outlet pressure",
    "dimension": "pressure",
    "defaultUnit": "bar"
  },
  "branch-1/blocks/1/efficiency": {
    "block_type": "Compressor",
    "property": "efficiency",
    "required": false
  },
  "branch-2/blocks/0/length": {
    "block_type": "Pipe",
    "property": "length",
    "required": false,
    "title": "Length",
    "dimension": "length",
    "defaultUnit": "m"
  }
}
```

This endpoint:

- Returns schema properties for every block instance in the network
- Uses the same flattened path format as `/api/schema/properties`
- Keys are paths like `branch-1/blocks/0/length`
- Shows which properties are required vs optional for each block
- Includes metadata: `title` (display name), `dimension`, and `defaultUnit` when available
- Perfect for generating form fields for all blocks in a network at once

### Get Block Schema Properties

Get schema properties for blocks matching a query path. Returns flattened paths with property information:

```bash
# Get schema properties for a specific block
http GET localhost:3000/api/schema/properties network==preset1 q=="branch-4/blocks/2" version==v1.0

# Get schema properties for all blocks in a branch
http GET localhost:3000/api/schema/properties network==preset1 q=="branch-4/blocks" version==v1.0

# Get schema properties for filtered blocks
http GET localhost:3000/api/schema/properties network==preset1 q=="branch-4/blocks[type=Pipe]" version==v1.0
```

**Expected Response:**

```json
{
  "branch-4/blocks/2/length": {
    "required": true,
    "block_type": "Pipe",
    "property": "length",
    "title": "Length",
    "dimension": "length",
    "defaultUnit": "m"
  },
  "branch-4/blocks/2/diameter": {
    "required": false,
    "block_type": "Pipe",
    "property": "diameter",
    "title": "Diameter",
    "dimension": "length",
    "defaultUnit": "m"
  }
}
```

This endpoint:

- Uses the same query syntax as the query API
- Returns schema properties for each block instance found
- Keys are flattened paths like `branch-4/blocks/2/length`
- Shows which properties are required vs optional
- Includes metadata: `title` (display name), `dimension`, and `defaultUnit` when available
- Perfect for generating form fields for specific blocks

**Expected Response (for version endpoint):**

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

### Validate Blocks by Query

Validate blocks matching a query path. Returns validation results for each property:

```bash
# Validate a specific block
http GET localhost:3000/api/schema/validate network==preset1 q=="branch-4/blocks/2" version==v1.0

# Validate all blocks in a branch
http GET localhost:3000/api/schema/validate network==preset1 q=="branch-4/blocks" version==v1.0

# Validate filtered blocks
http GET localhost:3000/api/schema/validate network==preset1 q=="branch-4/blocks[type=Pipe]" version==v1.0
```

**Expected Response:**

```json
{
  "branch-4/blocks/2/length": {
    "is_valid": true,
    "value": 100.0,
    "scope": "block",
    "message": "Value found in block scope"
  },
  "branch-4/blocks/2/diameter": {
    "is_valid": true
  },
  "branch-4/blocks/2/ambientTemperature": {
    "is_valid": true,
    "value": 20.0,
    "scope": "global",
    "message": "Value found in global scope"
  },
  "branch-4/blocks/2/pressure": {
    "is_valid": false,
    "severity": "error",
    "message": "Required property 'pressure' is missing for block type 'Pipe'"
  }
}
```

This endpoint:

- Returns validation results for each property path
- Each property has `is_valid: true` if valid, or `is_valid: false` with `severity` and `message` if invalid
- When a property value is found (via scope resolution), includes `value` and `scope` fields
- The `scope` field indicates where the value came from: "block", "branch", "group", or "global"
- Required properties that are missing will have `severity: "error"`
- Optional properties that are present or missing are both considered valid
- Unknown properties are not validated (not an issue - allows validating subsets of properties)

### Validate Entire Network

Validate all blocks in a network. Returns validation results for each property in every block:

```bash
http GET localhost:3000/api/schema/network/validate network==preset1 version==v1.0
```

**Expected Response:**

```json
{
  "branch-1/blocks/0/length": {
    "is_valid": true,
    "value": 50.0,
    "scope": "block",
    "message": "Value found in block scope"
  },
  "branch-1/blocks/0/diameter": {
    "is_valid": true
  },
  "branch-1/blocks/0/ambientTemperature": {
    "is_valid": true,
    "value": 20.0,
    "scope": "global",
    "message": "Value found in global scope"
  },
  "branch-1/blocks/1/pressure": {
    "is_valid": false,
    "severity": "error",
    "message": "Required property 'pressure' is missing for block type 'Compressor'"
  },
  "branch-1/blocks/1/cost": {
    "is_valid": true,
    "value": 1000.0,
    "scope": "branch",
    "message": "Value found in branch scope"
  }
}
```

This endpoint:

- Returns validation results for each property path in the network
- Each property has `is_valid: true` if valid, or `is_valid: false` with `severity` and `message` if invalid
- When a property value is found (via scope resolution), includes `value` and `scope` fields
- The `scope` field indicates where the value came from: "block", "branch", "group", or "global"
- Required properties that are missing will have `severity: "error"`
- Optional properties that are present or missing are both considered valid
- Unknown properties are not validated (not an issue - allows validating subsets of properties)
- Perfect for validating entire networks and identifying validation issues per property

### Validate a Block (POST)

Validate a single block against a schema:

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
  "is_valid": false,
  "has_issues": true,
  "issues": [
    {
      "severity": "error",
      "message": "Required property 'pressure' is missing for block type 'Compressor'",
      "property": "pressure"
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
http GET localhost:3000/api/query q=="branch-4/blocks" network==preset1
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
http GET localhost:3000/api/query q=="branch-4/blocks/0/pressure?scope=block,branch,global" network==preset1
```

### Get Block Properties with Unit Preferences

```bash
# Get pipe length in preferred units (from config.toml)
http GET localhost:3000/api/query q=="branch-4/blocks[type=Pipe]/length" network==preset1

# Override to display in specific units
http GET localhost:3000/api/query q=="branch-4/blocks[type=Pipe]?units=length:km,diameter:m" network==preset1

# Get compressor pressure in bar
http GET localhost:3000/api/query q=="branch-4/blocks[type=Compressor]?units=pressure:bar" network==preset1
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
   http GET localhost:3000/api/query q=="branch-4/blocks/0/pressure?scope=block,branch,global" network==preset1
   ```

## Notes

- **Query parameter syntax**: Use `==` for query parameters in HTTPie
- **String values with special characters**: Wrap in quotes, e.g., `q=="branch-4/blocks[type=Pipe]"`
- **JSON in POST requests**: Use `:=` for JSON values, e.g., `block:='{"type":"Compressor","pressure":15.5}'`
- **Network names**: Use network names (e.g., `preset1`) not full paths
- **Default network**: If `network` parameter is omitted, it may default to `preset1` (check route implementation)
- **Schemas directory**: The `schemasDir` parameter defaults to `../schemas` (relative to backend directory)
- **Unit preferences**: Configure defaults in `config.toml` under `[unitPreferences]`, or override per-query using `?units=property:unit` parameter
- **Combining parameters**: Multiple query parameters can be combined with `&`, e.g., `?scope=block,branch,global&units=pressure:bar`
