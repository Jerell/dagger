# Effect Schema Validation Refactor Plan

## Overview

Refactor validation to use Effect Schema directly in TypeScript, eliminating the need for JSON schema generation and Rust-based validation. Effect Schema's annotation system makes metadata extraction more straightforward than Zod.

**Key Changes**:

- Schemas moved from `schemas/` to `backend/src/schemas/` (CLI no longer needs them)
- All validation happens in backend using Effect Schema
- CLI validation removed entirely

## Current Architecture

### Current Flow

```
Zod Schema (TypeScript)
  ↓
generate-schemas.ts (extracts metadata)
  ↓
JSON Schema Files
  ↓
Rust SchemaRegistry (loads JSON)
  ↓
WASM validate_* functions (checks required/optional)
  ↓
TypeScript formatValidationResults (unit formatting + constraint validation)
```

### Current Components

- **Schema Generation**: `schemas/generate-schemas.ts` - extracts metadata to JSON
- **Rust Schema Registry**: `cli/src/schema/registry.rs` - loads and manages JSON schemas
- **Rust Validator**: `cli/src/schema/validator.rs` - validates required/optional properties
- **WASM Validation**: `cli/src/wasm.rs` - `validate_query_blocks`, `validate_network_blocks`
- **TypeScript Validation**: `backend/src/services/schema.ts` - constraint validation with unit conversion

## Proposed Architecture

### New Flow

```
Effect Schema (TypeScript)
  ↓
TypeScript Validation Service (direct Effect Schema validation)
  ↓
Unit formatting + constraint validation (all in TypeScript)
```

### Why Effect Schema?

- **Better Metadata Extraction**: Effect Schema's [annotations system](https://effect.website/docs/schema/annotations/) makes it easier to extract metadata (dimension, defaultUnit, title, etc.)
- **Built-in JSON Schema**: Can generate JSON Schema directly from Effect Schema if needed
- **Type Safety**: Better TypeScript integration with `Schema.Type<typeof Schema>`
- **Structured API**: More predictable API for introspection and metadata access

### What Stays in WASM

- Network parsing: `load_network_from_files`, `load_network`
- Query execution: `query_from_files`
- Scope resolution: (handled by QueryExecutor)
- Node/edge retrieval: `get_nodes`, `get_edges`

### What Moves to TypeScript

- All schema validation (required, optional, constraints)
- Schema metadata extraction (from Zod `.meta()`)
- Constraint validation with unit conversion
- Schema property listing

## Implementation Plan

### Phase 0: Migrate Schemas to Effect Schema and Move to Backend

**Files**:

- **Source**: `schemas/v1.0/*.ts`, `schemas/v1.0-costing/*.ts`
- **Destination**: `backend/src/schemas/v1.0/*.ts`, `backend/src/schemas/v1.0-costing/*.ts`

**Schema Organization**:

- Keep directory structure: `backend/src/schemas/{schemaSet}/`
- Schema sets: `v1.0` (modelling), `v1.0-costing` (costing), etc.
- Each schema set can have different validation rules for the same block types
- Users select schema set when validating (e.g., `version="v1.0-costing"`)

**Tasks**:

1. **Move schemas directory**: Move `schemas/` to `backend/src/schemas/`
   - Create `backend/src/schemas/` directory
   - Move all schema set directories (v1.0, v1.0-costing, etc.)
   - Update all import paths in moved files
   - Remove `schemas/` from root directory
2. Convert existing Zod schemas to Effect Schema syntax
3. Use Effect Schema annotations for metadata:
   - `Schema.annotations({ dimension: "length", defaultUnit: "m", title: "Length" })`
4. Use Effect Schema's built-in constraints:
   - `Schema.Number.pipe(Schema.greaterThan(200))` for min
   - `Schema.Number.pipe(Schema.lessThan(1000))` for max
5. Use `Schema.optional()` for optional properties
6. Export schemas with naming convention: `PipeSchema`, `CompressorSchema`, etc.
7. Update `backend/package.json` if needed (add Effect Schema dependency)
8. Remove `schemas/package.json` and related build scripts (no longer needed)

**Example Migration**:

```typescript
// Before (Zod)
export const PipeSchema = z.object({
  type: z.literal("Pipe"),
  length: z.number().min(200).meta({ dimension: "length", defaultUnit: "m" }),
  diameter: z
    .number()
    .min(0)
    .optional()
    .meta({ dimension: "length", defaultUnit: "m" }),
});

// After (Effect Schema)
import { Schema } from "effect";

export const PipeSchema = Schema.Struct({
  type: Schema.Literal("Pipe"),
  length: Schema.Number.pipe(
    Schema.greaterThan(200),
    Schema.annotations({
      dimension: "length",
      defaultUnit: "m",
      title: "Length",
    })
  ),
  diameter: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        dimension: "length",
        defaultUnit: "m",
        title: "Diameter",
      })
    ),
    { exact: true }
  ),
});
```

### Phase 1: Create Static Schema Registry

**Files**:

- `backend/src/schemas/index.ts` - Static registry that imports all schemas
- `backend/src/services/effectSchemas.ts` - Helper functions for schema access

**Approach**: Static registry instead of dynamic imports

**Tasks**:

1. **Create schema registry file** (`backend/src/schemas/index.ts`) that imports all schemas statically:

   ```typescript
   // Import all schemas from all schema sets
   import { PipeSchema as V10PipeSchema } from "./v1.0/pipe.js";
   import { CompressorSchema as V10CompressorSchema } from "./v1.0/compressor.js";
   import { PipeSchema as V10CostingPipeSchema } from "./v1.0-costing/pipe.js";
   import { CompressorSchema as V10CostingCompressorSchema } from "./v1.0-costing/compressor.js";

   // Registry maps: schemaSet -> blockType -> Schema
   export const schemaRegistry = {
     "v1.0": {
       Pipe: V10PipeSchema,
       Compressor: V10CompressorSchema,
     },
     "v1.0-costing": {
       Pipe: V10CostingPipeSchema,
       Compressor: V10CostingCompressorSchema,
     },
   } as const;
   ```

2. **Create helper functions** in `backend/src/services/effectSchemas.ts`:

   ```typescript
   import { schemaRegistry } from "../schemas/index.js";
   import { Schema } from "effect";

   function getSchema(
     schemaSet: string,
     blockType: string
   ): Schema.Schema<any> | undefined {
     return schemaRegistry[schemaSet]?.[blockType];
   }

   function listSchemaSets(): string[] {
     return Object.keys(schemaRegistry);
   }

   function listBlockTypes(schemaSet: string): string[] {
     return Object.keys(schemaRegistry[schemaSet] || {});
   }
   ```

3. **Extract metadata from Effect schemas** using annotations:
   - Access annotations via `Schema.annotations(schema)` or schema introspection
   - Required/optional properties (from `Schema.optional()`)
   - Min/max constraints (from `Schema.greaterThan()`, `Schema.lessThan()`)
   - Metadata from annotations: `dimension`, `defaultUnit`, `title`

**Key Functions**:

```typescript
function getSchema(
  schemaSet: string,
  blockType: string
): Schema.Schema<any> | undefined;
function getSchemaMetadata(schema: Schema.Schema<any>): PropertyMetadata;
function getRequiredProperties(schema: Schema.Schema<any>): string[];
function getOptionalProperties(schema: Schema.Schema<any>): string[];
function getPropertyConstraints(
  schema: Schema.Schema<any>,
  property: string
): { min?: number; max?: number };
function listSchemaSets(): string[];
function listBlockTypes(schemaSet: string): string[];
```

**Metadata Extraction**:
Effect Schema provides better introspection capabilities:

- Use `Schema.annotations()` to get annotations
- Use schema structure to determine required/optional
- Use `Schema.ast` or schema traversal for constraint extraction

### Phase 2: Create TypeScript Validation Service

**File**: `backend/src/services/effectValidation.ts`

**Tasks**:

1. Create validation function that:
   - Takes a block object and block type
   - Loads the appropriate Effect Schema
   - Uses `Schema.decodeUnknownEither()` or `Schema.decodeUnknown()` to validate
   - Returns validation results in the same format as current API
2. Handle scope resolution:
   - Query WASM to get block with scope-resolved values
   - Validate the resolved block
3. Handle unit conversion for constraints:
   - Extract value and defaultUnit from schema annotations
   - Convert value to defaultUnit using dim
   - Compare against min/max constraints (extracted from schema)
4. Return per-property validation results:
   ```typescript
   {
     "branch-1/blocks/0/length": {
       "is_valid": true,
       "value": "100 m",
       "scope": "block"
     }
   }
   ```

**Key Functions**:

```typescript
import { Schema } from "effect";

async function validateBlock(
  block: any,
  blockType: string,
  version: string,
  networkPath: string,
  configContent: string | null
): Promise<ValidationResult>;

async function validateQueryBlocks(
  query: string,
  networkPath: string,
  schemaSet: string, // e.g., "v1.0" or "v1.0-costing"
  configContent: string | null
): Promise<Record<string, ValidationResult>>;

async function validateNetworkBlocks(
  networkPath: string,
  schemaSet: string, // e.g., "v1.0" or "v1.0-costing"
  configContent: string | null
): Promise<Record<string, ValidationResult>>;
```

**Effect Schema Validation**:

```typescript
import { schemaRegistry } from "../schemas/index.js";
import { Schema } from "effect";

// Get schema from static registry (synchronous, no async needed)
const schema = getSchema(schemaSet, blockType);
if (!schema) {
  throw new Error(`Schema not found: ${schemaSet}/${blockType}`);
}

// Validate using Effect Schema
const result = Schema.decodeUnknownEither(schema)(block);

if (Either.isLeft(result)) {
  // Handle validation errors
  const errors = result.left;
  // Format errors into per-property validation results
}
```

### Phase 3: Update API Routes

**File**: `backend/src/routes/schema.ts`

**Tasks**:

1. Replace calls to WASM validation functions with new Effect Schema validation functions
2. Update `GET /api/schema/validate` to use `validateQueryBlocks` from effectValidation
3. Update `GET /api/schema/network/validate` to use `validateNetworkBlocks` from effectValidation
4. Keep `POST /api/schema/validate` but use Effect Schema directly

### Phase 4: Update Schema Property Endpoints

**File**: `backend/src/services/schema.ts`

**Tasks**:

1. Replace `getBlockSchemaProperties` to use Effect schemas directly
2. Extract property metadata from Effect schemas using annotations
3. Return same format but sourced from Effect Schema

**Key Changes**:

- Remove dependency on `get_block_schema_properties` WASM function
- Use Effect Schema introspection and annotations to get property info
- Effect Schema's structured API makes this easier than Zod

### Phase 5: Remove JSON Schema Generation and Old Schemas Directory

**Files to Remove**:

- `schemas/generate-schemas.ts` - No longer needed
- `schemas/package.json` - No longer needed (schemas moved to backend)
- `schemas/tsconfig.json` - No longer needed
- `schemas/*/**.json` - All JSON schema files can be removed
- `schemas/node_modules/` - Can be removed
- Entire `schemas/` directory at root (already moved to `backend/src/schemas/`)

**Tasks**:

1. Remove `generate-schemas.ts` entirely
2. Remove `schemas/` directory from root (schemas already moved to `backend/src/schemas/`)
3. Update documentation to reflect direct Effect Schema usage
4. Remove any references to schema generation in build scripts
5. Update any CI/CD or build processes that referenced the old schemas directory

### Phase 6: Remove Rust Validation Code

**Files to Remove**:

- `cli/src/schema/registry.rs` - No longer needed (CLI validation removed)
- `cli/src/schema/validator.rs` - No longer needed
- WASM validation functions in `cli/src/wasm.rs`:
  - `validate_block`
  - `validate_query_blocks`
  - `validate_network_blocks`
  - `get_block_schema_properties`
  - `get_network_schemas`
  - `get_schemas`
  - `get_schema_versions`

**CLI Changes**:

- Remove `validate` command from CLI (`cli/src/main.rs`)
- CLI tool will only handle network parsing, querying, and export
- All validation happens in backend via Effect Schema

**Tasks**:

1. Remove `Validate` command from CLI
2. Remove Rust schema validation code
3. Update CLI documentation
4. Update `VALIDATION_COMMANDS.md` to point to backend API

## Technical Considerations

### 1. Effect Schema Metadata Extraction

**Challenge**: Extract metadata from Effect schemas programmatically

**Solution**: Effect Schema's annotations system makes this straightforward:

```typescript
import { Schema } from "effect";

function extractMetadata(schema: Schema.Schema<any>): PropertyMetadata {
  // Access annotations directly
  const annotations = Schema.annotations(schema);
  // Or traverse schema AST to get property-level annotations
  // Effect Schema provides structured access to annotations
}

// For property-level metadata in Struct schemas:
function getPropertyMetadata(
  structSchema: Schema.Struct<any>,
  propertyName: string
): PropertyMetadata {
  // Access property schema from struct
  const propertySchema = structSchema.fields[propertyName];
  // Get annotations from property schema
  return Schema.annotations(propertySchema);
}
```

**Advantages over Zod**:

- Effect Schema has a more structured API for introspection
- Annotations are first-class citizens, not hidden in `.meta()`
- Built-in JSON Schema generation can help with metadata extraction

### 2. Schema Loading Strategy

**Challenge**: How to load and organize schemas

**Solution**: Use static registry instead of dynamic imports

**Approach**:

- Import all schemas statically in `backend/src/schemas/index.ts`
- Store in a registry object: `{ schemaSet: { blockType: Schema } }`
- Access schemas synchronously: `schemaRegistry[schemaSet][blockType]`

**Benefits**:

- ✅ No dynamic imports - simpler, more predictable
- ✅ Type-safe - TypeScript knows all schemas at compile time
- ✅ Faster - no async loading needed
- ✅ Works with all bundlers
- ✅ Supports multiple schema sets simultaneously (v1.0, v1.0-costing, etc.)

**Considerations**:

- Need to manually add new schemas to registry (but this is explicit and clear)
- All schemas loaded at startup (but they're just schema definitions, not heavy)
- If schemas become very large, could use lazy loading, but probably not needed

### 3. Unit Conversion for Constraints

**Challenge**: Convert values to defaultUnit before comparing constraints

**Solution**: Already implemented in TypeScript using dim library:

```typescript
const valueInDefaultUnit = dim.eval(`${originalValue} as ${defaultUnit}`);
const numericValue = parseFloat(valueInDefaultUnit.split(" ")[0]);
// Compare numericValue against min/max
```

### 4. Scope Resolution Integration

**Challenge**: Validate blocks with scope-resolved values

**Solution**:

- Query WASM to get block with scope-resolved properties
- Validate the resolved block using Effect Schema
- Include scope information in validation results

### 5. CLI Tool Compatibility

**Decision**: Remove validation from CLI tool entirely

**Rationale**:

- CLI tool focuses on network parsing, querying, and export
- Validation is better suited for the backend where we have Effect Schema
- Simplifies CLI codebase significantly
- Users can use backend API for validation if needed

**Migration Path**:

- Remove `validate` command from CLI
- Update documentation to point users to backend validation endpoints
- CLI remains useful for network inspection and querying

## Migration Strategy

### Step 1: Parallel Implementation

- Implement new Zod validation alongside existing Rust validation
- Add feature flag or new endpoint to test Zod validation
- Keep existing endpoints working

### Step 2: Gradual Migration

- Update one endpoint at a time
- Test thoroughly before moving to next
- Keep Rust code as fallback

### Step 3: Remove Old Code

- Once all endpoints migrated and tested
- Remove Rust validation code
- Remove JSON schema generation (or keep for CLI)

## Benefits

1. **Single Source of Truth**: Effect schemas are the only schema definition
2. **Simpler Architecture**: No JSON generation step, no Rust schema registry
3. **Better Type Safety**: Direct TypeScript/Effect Schema integration with `Schema.Type<typeof Schema>`
4. **Easier Maintenance**: All validation logic in one language
5. **Better Metadata Extraction**: Effect Schema's annotations system is more structured than Zod's `.meta()`
6. **Built-in JSON Schema**: Can generate JSON Schema directly if needed
7. **Better Error Messages**: Effect Schema provides detailed error messages
8. **Functional Approach**: Effect Schema fits well with functional programming patterns

## Risks & Mitigations

### Risk 1: Performance

**Concern**: TypeScript validation might be slower than Rust
**Mitigation**:

- Profile and optimize if needed
- Effect Schema is performant (part of Effect ecosystem optimized for performance)
- Validation is not a hot path (usually done on user request)

### Risk 2: Dynamic Imports

**Concern**: Dynamic imports might be tricky in Node.js
**Mitigation**:

- Use proper path resolution
- Consider bundling schemas at build time
- Test thoroughly in production-like environment

### Risk 3: Breaking Changes

**Concern**: API response format might change
**Mitigation**:

- Keep response format identical
- Comprehensive testing
- Gradual migration with feature flags

## Testing Plan

1. **Unit Tests**: Test Zod schema loading and metadata extraction
2. **Integration Tests**: Test validation with real network data
3. **API Tests**: Test all validation endpoints return correct format
4. **Edge Cases**: Test with missing properties, invalid values, scope resolution
5. **Performance Tests**: Compare with current Rust validation

## Timeline Estimate

- **Phase 0**: 2-3 days (Migrate schemas to Effect Schema + move to backend)
- **Phase 1**: 2-3 days (Effect Schema loader)
- **Phase 2**: 3-4 days (TypeScript validation service)
- **Phase 3**: 1 day (Update API routes)
- **Phase 4**: 1-2 days (Update schema property endpoints)
- **Phase 5**: 0.5 day (Remove JSON generation and old schemas directory)
- **Phase 6**: 1-2 days (Remove Rust validation code)
- **Testing**: 2-3 days

**Total**: ~12-17 days

## Success Criteria

1. All validation endpoints work with Effect schemas
2. Response format matches current API
3. Unit conversion for constraints works correctly
4. Scope resolution integrated properly
5. Performance is acceptable
6. No breaking changes to API
7. Documentation updated

## Open Questions

1. ~~Should we keep Rust validation for CLI tool?~~ **RESOLVED**: Remove validation from CLI
2. ~~How to handle dynamic schema imports in production?~~ **RESOLVED**: Use static registry - no dynamic imports needed
3. ~~Should we bundle schemas at build time?~~ **RESOLVED**: Static registry works with bundlers automatically
4. ~~Do we need to support multiple schema versions simultaneously?~~ **RESOLVED**: Yes, via schema sets (v1.0, v1.0-costing, etc.) - static registry supports this
5. How to handle schema versioning and migration?
6. Should we use Effect's runtime for validation, or use standalone Effect Schema?
7. ~~File-based vs registry approach?~~ **RESOLVED**: Static registry is simpler - file-based directories are fine for organization, but registry provides access
