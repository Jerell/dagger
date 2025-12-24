# Integration Plan: Zig `dim` Library for Unit Parsing in Rust Tool

## Overview

This plan outlines how to integrate the Zig `dim` library into the Rust `dagger` tool to enable parsing and handling of unit strings (e.g., `"100 bar"`, `"10 m"`, `"5 kg/s"`) from TOML configuration files.

## Current State

- **Rust Tool**: Parses TOML files containing network configurations
- **TOML Structure**: Blocks have `extra: HashMap<String, Value>` for dynamic properties
- **Current Behavior**: Properties are stored as-is (strings, numbers, etc.)
- **Zig Library**: `dim` provides unit parsing, conversion, and dimensional analysis via CLI-like expression evaluation

## Integration Architecture

### Option 1: WASM Integration (Recommended)

**Pros:**

- Cross-platform (no native library compilation needed)
- Already have WASM infrastructure in the project
- Easy to bundle and distribute
- The `dim` library already supports WASM compilation

**Cons:**

- Slight performance overhead (minimal for parsing use case)
- Requires WASM runtime

### Option 2: Native Library (C ABI)

**Pros:**

- Maximum performance
- Direct function calls

**Cons:**

- Need to compile Zig library for each target platform
- More complex build process
- Platform-specific binaries

**Recommendation**: Use **Option 1 (WASM)** since:

1. The project already uses WASM (`wasm-bindgen`)
2. `dim` library already has WASM support
3. Unit parsing is not performance-critical
4. Easier distribution and cross-platform support

## Implementation Plan

### Phase 1: Build Zig `dim` as WASM Module

#### 1.1 Set up Zig Build for WASM

- Add a build target in `dim` repository to export a minimal C-ABI interface
- Export functions:
  - `dim_eval(input_ptr, input_len, out_ptr_ptr, out_len_ptr) -> i32`
  - `dim_alloc(n) -> u8*`
  - `dim_free(ptr, len) -> void`
- Build command: `zig build -Dtarget=wasm32-wasi -Doptimize=ReleaseSmall`

#### 1.2 Create WASM Wrapper Module

- Create a new Rust crate: `cli/src/dim_wasm/` or use existing WASM infrastructure
- Use `wasmtime` or `wasmer` to load and execute the WASM module
- Wrap the C-ABI functions in safe Rust APIs

**Files to create:**

- `cli/src/dim/mod.rs` - Main module
- `cli/src/dim/wasm.rs` - WASM runtime wrapper
- `cli/src/dim/parser.rs` - Unit string parsing logic

### Phase 2: Create Rust Unit Parsing Interface

#### 2.1 Define Unit Value Types

```rust
// cli/src/dim/types.rs
#[derive(Debug, Clone)]
pub enum UnitValue {
    /// Parsed and normalized to base SI units
    Normalized {
        value: f64,
        unit: String,  // Base SI unit (e.g., "Pa", "m", "K")
        original: String,  // Original string for display
    },
    /// Could not parse as unit expression
    Unparsed(String),
}

#[derive(Debug)]
pub struct UnitParseResult {
    pub value: f64,
    pub base_unit: String,
    pub original: String,
}
```

#### 2.2 Create Parser API

```rust
// cli/src/dim/parser.rs
pub struct DimParser {
    wasm_instance: WasmInstance,  // or similar
}

impl DimParser {
    /// Parse a unit string (e.g., "100 bar", "10 m", "5 kg/s")
    /// Returns the value in base SI units
    pub fn parse_unit_string(&self, input: &str) -> Result<UnitParseResult, DimError> {
        // Call dim_eval via WASM
        // Return normalized value
    }

    /// Convert a value to a specific unit for display
    pub fn convert_to_unit(&self, value: f64, base_unit: &str, target_unit: &str)
        -> Result<f64, DimError> {
        // Use dim_eval with "as" syntax
    }

    /// Format a value with appropriate SI prefix
    pub fn format_with_prefix(&self, value: f64, unit: &str) -> Result<String, DimError> {
        // Use dim formatting
    }
}
```

### Phase 3: Integrate with TOML Parsing

#### 3.1 Custom TOML Value Deserializer

Create a custom deserializer that:

1. Detects string values that look like unit expressions
2. Attempts to parse them using `dim`
3. Stores both the original string and normalized value

**Approach A: Post-processing (Recommended)**

- Parse TOML normally first
- Then walk the `HashMap<String, Value>` and process string values
- Replace strings with unit expressions with normalized values

**Approach B: Custom Deserializer**

- Implement custom `Deserialize` for properties that might contain units
- More complex but type-safe

**Recommendation**: Use **Approach A** for flexibility and easier implementation.

#### 3.2 Unit Detection Strategy

Detect potential unit strings by:

- Checking if string contains common unit patterns (letters after numbers)
- Or use a whitelist of properties that should be parsed as units
- Or use schema metadata to identify unit properties

```rust
// cli/src/dim/detector.rs
pub fn looks_like_unit_string(s: &str) -> bool {
    // Pattern: number followed by optional whitespace and letters
    // Examples: "100 bar", "10.5 m", "5 kg/s", "1e3 Pa"
    let pattern = regex::Regex::new(r"^-?\d+(\.\d+)?([eE][+-]?\d+)?\s*[a-zA-Z/]+").unwrap();
    pattern.is_match(s.trim())
}
```

#### 3.3 Integration Points

**Location 1: Parser (`cli/src/parser/loader.rs`)**

```rust
fn load_node_from_content(...) -> Result<NodeData, ...> {
    let mut node = /* parse TOML */;

    // Post-process to parse unit strings
    let dim_parser = DimParser::new()?;
    parse_units_in_node(&mut node, &dim_parser)?;

    Ok(node)
}
```

**Location 2: Scope Resolver (`cli/src/scope/resolver.rs`)**

- When resolving properties, check if they're unit strings
- Parse and normalize on-the-fly if needed

**Location 3: Query Executor (`cli/src/query/executor.rs`)**

- When querying properties, handle unit strings
- Convert to requested units if needed

### Phase 4: Storage Strategy

#### Option A: Store Normalized Values

- Parse unit strings during TOML loading
- Store as numbers in base SI units
- Store original string in metadata for display

**Pros:**

- Consistent internal representation
- Easy to do calculations
- Schema validation works with numbers

**Cons:**

- Lose original unit information
- Need to track which properties are units

#### Option B: Store Original Strings + Metadata

- Keep original unit strings in TOML `Value`
- Store metadata about which properties are units
- Parse on-demand when needed

**Pros:**

- Preserve original user input
- Flexible

**Cons:**

- More complex
- Need to parse repeatedly

#### Option C: Hybrid Approach (Recommended)

- Store normalized value as number in `extra` HashMap
- Store original string in a parallel metadata structure
- Use a naming convention: `pressure` (normalized) + `pressure_unit` (original) or `_pressure_original`

**Implementation:**

```rust
// When parsing unit string "100 bar"
extra.insert("pressure".to_string(), Value::Float(1e7));  // 100 bar = 1e7 Pa
extra.insert("_pressure_original".to_string(), Value::String("100 bar".to_string()));
```

### Phase 5: Schema Integration

#### 5.1 Extend Schema Definitions

Add unit metadata to schema definitions:

```typescript
// schemas/v1.0/compressor.ts
export const CompressorSchema = z.object({
  type: z.literal("Compressor"),
  quantity: z.number().optional().default(1),

  pressure: z
    .number()
    .min(0)
    .describe("Operating pressure in PSI")
    .meta({ unit: "pressure", defaultUnit: "bar" }), // New metadata
});
```

#### 5.2 Schema-Aware Parsing

- Use schema metadata to identify which properties should be parsed as units
- Validate that parsed units match expected dimensions (e.g., pressure must be pressure, not length)

### Phase 6: Display and Formatting

#### 6.1 Pretty Printing

When displaying values:

- Use original unit string if available
- Or format with appropriate SI prefix (e.g., "1.0 kPa" instead of "1000 Pa")
- Support formatting modes: `:scientific`, `:engineering`, `:auto`

#### 6.2 Query Output

- In query results, show values in original units or requested units
- Support unit conversion in queries: `pressure as bar`, `pressure as Pa`

## File Structure

```
cli/
├── src/
│   ├── dim/
│   │   ├── mod.rs              # Main module exports
│   │   ├── wasm.rs             # WASM runtime wrapper
│   │   ├── parser.rs           # Unit parsing logic
│   │   ├── types.rs            # Unit value types
│   │   ├── detector.rs         # Unit string detection
│   │   └── error.rs            # Error types
│   ├── parser/
│   │   └── loader.rs           # Modified to parse units
│   └── ...
├── Cargo.toml                  # Add wasmtime/wasmer dependency
└── build.rs                    # Copy dim.wasm to output directory

dim/                            # Zig library (separate repo)
└── build.zig                   # Add WASM export target
```

## Dependencies to Add

```toml
# cli/Cargo.toml
[dependencies]
wasmtime = "21.0"  # or wasmer = "4.0"
regex = "1.10"
```

## Build Process

1. **Build Zig library as WASM:**

   ```bash
   cd dim
   zig build -Dtarget=wasm32-wasi -Doptimize=ReleaseSmall
   # Output: zig-out/bin/dim_wasm.wasm
   ```

2. **Copy WASM to Rust project:**

   ```bash
   cp dim/zig-out/bin/dim_wasm.wasm cli/src/dim/dim.wasm
   ```

3. **Embed WASM in Rust binary:**
   - Use `include_bytes!()` macro
   - Or load from file at runtime

## Testing Strategy

1. **Unit Tests:**

   - Test unit string detection
   - Test parsing various unit expressions
   - Test conversion between units
   - Test error handling

2. **Integration Tests:**

   - Test TOML files with unit strings
   - Test schema validation with units
   - Test querying with units

3. **Example TOML:**
   ```toml
   [[block]]
   type = "Compressor"
   pressure = "100 bar"        # Should parse to 1e7 Pa
   efficiency = 0.85
   flow_rate = "5 m³/s"        # Should parse to 5 m³/s
   ```

## Migration Path

1. **Phase 1**: Build WASM module and basic parser (no integration)
2. **Phase 2**: Add unit parsing to TOML loader (opt-in via feature flag)
3. **Phase 3**: Add schema metadata for unit properties
4. **Phase 4**: Enable by default, add formatting support
5. **Phase 5**: Add query-time unit conversion

## Error Handling

- If unit string cannot be parsed, keep as original string (don't fail)
- Log warnings for unparseable unit strings
- Provide clear error messages for invalid unit expressions
- Support fallback to plain number parsing

## Future Enhancements

1. **Unit Validation**: Check dimensional consistency (e.g., can't assign length to pressure)
2. **Unit Arithmetic**: Support expressions like `"10 bar + 5 bar"` in TOML
3. **Custom Units**: Allow defining custom units in config.toml
4. **Unit Preferences**: Store user's preferred units for display
5. **Query Language**: Extend query syntax to support unit conversions

## Open Questions

1. **When to parse?** During TOML loading or on-demand?

   - **Answer**: During loading for consistency, with caching

2. **How to handle unit mismatches?** (e.g., schema expects pressure but gets length)

   - **Answer**: Validate during schema validation phase

3. **Should we preserve original strings?**

   - **Answer**: Yes, for display and user feedback

4. **Performance concerns?**
   - **Answer**: WASM overhead is minimal for parsing; can cache parsed values

## Next Steps

1. ✅ Review and approve this plan
2. Set up Zig `dim` WASM build
3. Create Rust WASM wrapper module
4. Implement unit string detection
5. Integrate with TOML parser
6. Add tests
7. Update documentation
