# Unified Value Formatting

## Overview

All value formatting in the backend is now handled by a **unified service** (`valueFormatter.ts`) that ensures consistent behavior across all endpoints, whether values come from:

- Block properties
- Scope resolution (global, group, branch properties)
- Query results

**Note:** Validation is performed entirely in TypeScript using Effect Schema (not Zod). Schemas are located in `backend/src/schemas/` and organized by version (e.g., `v1.0/`, `v1.0-costing/`).

## Architecture

### Core Service: `valueFormatter.ts`

The `formatValueUnified` function is the single entry point for formatting any value:

```typescript
formatValueUnified(
  value: string | number | null | undefined,
  options: FormatValueOptions
): Promise<string | undefined>
```

**Features:**

- Handles unit strings (e.g., "1 mi") uniformly
- Handles numeric values (with original string lookup)
- Automatically looks up schema metadata if not provided
- Falls back to config dimension map for global properties
- Uses the same unit preference precedence as query endpoint

### Unit Preference Precedence

1. **Query parameter override** (only for query endpoint)
2. **Block-type preference**: `[unitPreferences.Pipe] length = "km"`
3. **Dimension-level preference**: `[unitPreferences.dimensions] length = "km"`
4. **Schema defaultUnit**: From schema metadata
5. **Original value**: Return as-is if no preferences

## Usage

### In Validation Endpoint

```typescript
import { formatValueUnified, FormatValueOptions } from "./valueFormatter.js";

const formatOptions: FormatValueOptions = {
  propertyName: "length",
  blockType: "Pipe",
  unitPreferences,
  propertyMetadata,
  networkPath,
  schemaSet,
  blockPath,
};

const formattedValue = await formatValueUnified(valueToFormat, formatOptions);
```

### In Query Endpoint

The query endpoint uses `formatQueryResult` which internally uses `formatValueUnified` for single values, ensuring consistency.

## Benefits

1. **No Duplication**: Single source of truth for value formatting logic
2. **Consistency**: All endpoints format values the same way
3. **Maintainability**: Changes to formatting logic only need to be made in one place
4. **Testability**: Unified formatter is easily testable in isolation

## Testing

Tests are in `valueFormatter.test.ts` using Vitest:

```bash
npm test
```

Tests cover:

- Block-type preferences
- Dimension-level preferences
- Schema defaultUnit fallback
- Global property formatting
- Edge cases (null, undefined, invalid strings)

## Migration Notes

- `effectValidation.ts` now uses `formatValueUnified` instead of duplicating logic
- `unitFormatter.ts` uses `formatValueUnified` for single string values
- All endpoints now produce consistently formatted values
