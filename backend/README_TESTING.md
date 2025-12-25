# Value Formatting and Testing

## Unified Value Formatting Service

All value formatting is now handled by a unified service (`valueFormatter.ts`) that ensures consistent behavior across all endpoints:

- `/api/query` - Query endpoint
- `/api/schema/validate` - Validation endpoint
- `/api/schema/properties` - Schema properties endpoint

**Note:** Validation is performed entirely in TypeScript using Effect Schema (not Zod). Schemas are located in `backend/src/schemas/` and organized by version (e.g., `v1.0/`, `v1.0-costing/`).

The unified formatter handles values uniformly, whether they come from:

- Block properties
- Scope resolution (global, group, branch properties)
- Query results

## Expected Behavior

All endpoints should format values in responses according to unit preferences, using the same precedence rules.

### Unit Preference Precedence

1. **Query parameter override** (not applicable for validation endpoint)
2. **Block-type preference in config**: `[unitPreferences.Pipe] length = "km"`
3. **Dimension-level preference in config**: `[unitPreferences.dimensions] length = "km"`
4. **Schema defaultUnit**: From schema metadata (e.g., `defaultUnit: "m"`)

### Examples

#### Example 1: Block-type preference

**Config:**

```toml
[unitPreferences.Pipe]
length = "km"
```

**Block data:**

```toml
length = "1 mi"
```

**Expected validation response:**

```json
{
  "branch-2/blocks/0/length": {
    "is_valid": true,
    "value": "1.60934 km", // ✅ Converted to km
    "scope": "block"
  }
}
```

**NOT:**

```json
{
  "branch-2/blocks/0/length": {
    "is_valid": true,
    "value": "1 mi", // ❌ Raw value
    "scope": "block"
  }
}
```

#### Example 2: Dimension-level preference

**Config:**

```toml
[unitPreferences.dimensions]
length = "km"
```

**Block data:**

```toml
length = "100 m"
```

**Expected validation response:**

```json
{
  "branch-2/blocks/0/length": {
    "is_valid": true,
    "value": "0.1 km", // ✅ Converted to km
    "scope": "block"
  }
}
```

#### Example 3: Schema defaultUnit (no preferences)

**Config:**

```toml
# No unit preferences
```

**Schema:**

```typescript
length: Schema.Number.pipe(
  Schema.greaterThan(200),
  Schema.annotations({
    dimension: "length",
    defaultUnit: "m", // Default unit
    title: "Length",
  })
);
```

**Block data:**

```toml
length = "1 mi"
```

**Expected validation response:**

```json
{
  "branch-2/blocks/0/length": {
    "is_valid": true,
    "value": "1609.34 m", // ✅ Converted to defaultUnit (m)
    "scope": "block"
  }
}
```

## Implementation Notes

- Values are formatted using the same `formatValue` function as the query endpoint
- Original value strings are stored in `unitPreferences.originalStrings` before formatting
- Unit conversion uses the `dim` library (same as query endpoint)
- All values in validation responses (both valid and invalid) should be formatted

## Testing

To verify this behavior:

```bash
# Set up config with unit preferences
# Query the validation endpoint
http GET localhost:3000/api/schema/validate network==preset1 q=="branch-2/blocks" version==v1.0

# Verify values are formatted according to preferences
# Compare with query endpoint output
http GET localhost:3000/api/query network==preset1 q=="branch-2/blocks"
```

Both endpoints should return the same formatted values for the same properties.
