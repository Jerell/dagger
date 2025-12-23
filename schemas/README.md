# Dagger Schema Libraries

This directory contains versioned schema libraries for block types. Schemas are written as Zod schemas in TypeScript, then converted to JSON for use by the Rust validator.

## Structure

```
schemas/
  v1.0/
    compressor.ts    # Zod schema definition
    compressor.json  # Generated JSON (from Zod)
    pipe.ts
    pipe.json
  v1.1/
    ...
```

## Generating JSON from Zod Schemas

After writing or updating Zod schemas, generate the JSON files:

```bash
cd schemas
npm install  # First time only
npm run generate
```

This will parse all TypeScript/Zod schema files and generate corresponding JSON files that the Rust validator can read.

**Note:** JSON files are generated and should not be committed to version control (see `.gitignore`). They are generated automatically when needed.

## Schema Format

Zod schemas should export a schema named `{BlockType}Schema`:

```typescript
import { z } from "zod";

export const CompressorSchema = z.object({
  type: z.literal("Compressor"),
  quantity: z.number().optional().default(1),

  // Required properties
  pressure: z.number().min(0).describe("Operating pressure in PSI"),

  // Optional properties
  efficiency: z.number().min(0).max(1).default(0.85).optional(),
});
```

The generator will extract:

- `block_type`: From schema name (e.g., "CompressorSchema" → "Compressor")
- `required`: Properties without `.optional()`
- `optional`: Properties with `.optional()`

Note: `type` and `quantity` are always present and are excluded from required/optional lists.
