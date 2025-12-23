# Query Syntax Documentation

The Dagger CLI provides a powerful query system for inspecting and extracting data from network structures. This document describes the query syntax and features.

## Basic Query Syntax

Queries use a URL-like path notation to navigate through the network structure.

### Node Queries

Query a specific node by its ID:

```bash
dagger query "branch-4" ../network/preset1
```

Returns the entire node object.

### Property Access

Access properties of nodes using `/` separator:

```bash
# Get node label
dagger query "branch-4/label" ../network/preset1

# Get node position
dagger query "branch-4/position" ../network/preset1

# Get position X coordinate
dagger query "branch-4/position/x" ../network/preset1
```

### Array Indexing

Access array elements by numeric index:

```bash
# Get first block
dagger query "branch-4/data/blocks/0" ../network/preset1

# Get second block
dagger query "branch-4/data/blocks/1" ../network/preset1
```

### Nested Property Access

Navigate through nested structures:

```bash
# Get block type
dagger query "branch-4/data/blocks/0/type" ../network/preset1

# Get block properties
dagger query "branch-4/data/blocks/0/pressure" ../network/preset1
```

## Filtering

Filter arrays based on field values using bracket notation:

### Equality Filters

```bash
# Get all Compressor blocks
dagger query "branch-4/data/blocks[type=Compressor]" ../network/preset1

# Get all source blocks
dagger query "branch-4/data/blocks[kind=source]" ../network/preset1
```

### Comparison Operators

Supported operators:

- `=` - Equals
- `!=` - Not equals
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal

```bash
# Get blocks with pressure > 10
dagger query "branch-4/data/blocks[pressure>10]" ../network/preset1

# Get blocks with quantity >= 2
dagger query "branch-4/data/blocks[quantity>=2]" ../network/preset1
```

### Nested Property Filters

Filter on nested properties using dot notation:

```bash
# Filter nodes by type
dagger query "nodes[data.type=branchNode]" ../network/preset1
```

## Network-Level Queries

Query the entire network structure:

### All Nodes

```bash
# Get all nodes
dagger query "nodes" ../network/preset1

# Get all branch nodes
dagger query "nodes[type=branchNode]" ../network/preset1

# Get all group nodes
dagger query "nodes[type=labeledGroupNode]" ../network/preset1
```

### All Edges

```bash
# Get all edges
dagger query "edges" ../network/preset1

# Get edges from specific source
dagger query "edges[source=branch-1]" ../network/preset1

# Get edges to specific target
dagger query "edges[target=branch-2]" ../network/preset1
```

## Scope Resolution

Resolve properties using the scope inheritance system. This allows you to get the effective value of a property after applying inheritance rules from `config.toml`.

### Basic Scope Resolution

```bash
# Resolve ambientTemperature for a block
dagger query "branch-4/data/blocks/0/ambientTemperature?scope=block,branch,group,global" ../network/preset1
```

The `?scope=...` parameter specifies the scope chain to check (though the actual inheritance rules come from `config.toml`).

### How Scope Resolution Works

1. The query path must point to a specific block (e.g., `branch-4/data/blocks/0`)
2. The property name is extracted from the end of the path
3. The scope resolver checks the property in the following order (by default):

   - **Block**: Check if the property exists in the block's `extra` fields
   - **Branch**: Check if the property exists in the branch node's `extra` fields
   - **Group**: Check if the property exists in the parent group's `extra` fields
   - **Global**: Check if the property exists in `config.toml` `[properties]` section

4. Returns the first value found, or an error if not found in any scope

### Example

Given a `config.toml`:

```toml
[properties]
ambientTemperature = 20.0

[inheritance]
general = ["block", "branch", "group", "global"]
ambientTemperature = ["group", "global"]
```

And a branch node with a block that doesn't have `ambientTemperature` set:

```bash
# This will resolve to 20.0 from global scope
dagger query "branch-4/data/blocks/0/ambientTemperature?scope=block,branch,group,global" ../network/preset1
```

## Output Format

All queries return JSON output, formatted for readability:

```json
{
  "id": "branch-4",
  "label": "Branch 4",
  "position": {
    "x": 100,
    "y": 200
  },
  "data": {
    "blocks": [
      {
        "type": "Compressor",
        "pressure": 15.5
      }
    ]
  }
}
```

## Error Handling

The query system provides clear error messages:

- **Node not found**: `Node 'branch-99' not found`
- **Property not found**: `Property 'invalidProperty' not found`
- **Index out of range**: `Index 5 out of range (length: 3)`
- **Invalid type**: `Cannot access property 'x' on non-object`
- **Scope resolution errors**: `Property 'temperature' not found in any scope`

## Examples

### Find all compressors in the network

```bash
dagger query "nodes[data.blocks[type=Compressor]]" ../network/preset1
```

### Get all blocks from a specific branch

```bash
dagger query "branch-4/data/blocks" ../network/preset1
```

### Get resolved pressure for a block

```bash
dagger query "branch-4/data/blocks/0/pressure?scope=block,branch,global" ../network/preset1
```

### Get all edges with weight > 1

```bash
dagger query "edges[data.weight>1]" ../network/preset1
```

### Get node position

```bash
dagger query "branch-4/position" ../network/preset1
```

## Integration with Other Commands

The query system integrates with other CLI commands:

- **Export**: Use queries to extract specific parts of the network
- **Validate**: Query results can be validated against schemas
- **Resolve**: The `resolve` command provides detailed scope resolution information

## Future Enhancements

Potential future additions to the query system:

- **JSONPath support**: More powerful path expressions
- **Aggregation functions**: `count()`, `sum()`, `avg()`, etc.
- **Multiple filters**: Combine multiple conditions with `AND`/`OR`
- **Sorting**: Order results by field values
- **Pagination**: Limit and offset for large result sets
