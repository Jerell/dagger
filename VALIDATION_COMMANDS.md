# Validation Testing Commands

Run these commands from the `cli/` directory using `cargo run --`.

## Basic Validation

```bash
# Validate all blocks against v1.0 schemas (defaults: path=../network/preset1, schemas-dir=../schemas)
cargo run -- validate v1.0

# Validate with custom network path
cargo run -- validate v1.0 --path ../network/preset2

# Validate with custom schemas directory
cargo run -- validate v1.0 --schemas-dir ../schemas
```

## Testing Required Properties

The v1.0 schema requires `pressure` for Compressor blocks. Test this:

```bash
# Should show errors for Compressor blocks missing 'pressure'
cargo run -- validate v1.0
```

To fix the errors, add `pressure` to Compressor blocks in the TOML files:

```toml
[[block]]
type = "Compressor"
pressure = 15.5  # Add this
```

Then validate again:

```bash
cargo run -- validate v1.0
```

## Testing Optional Properties

Optional properties (like `efficiency` for Compressor) won't cause errors if missing:

```bash
# This should pass even without 'efficiency'
cargo run -- validate v1.0
```

## Testing Unknown Properties

Add an unknown property to see warnings:

```toml
[[block]]
type = "Compressor"
pressure = 15.5
unknownProperty = "test"  # This will generate a warning
```

```bash
cargo run -- validate v1.0
```

## Testing Different Schema Versions

Create a new version (e.g., v1.1) with different requirements:

```bash
# After creating schemas/v1.1/compressor.ts and running npm run generate
cargo run -- validate v1.1
```

## Viewing Validation Summary

The validation command shows:

- **ERROR**: Missing required properties (exits with code 1)
- **WARN**: Unknown properties or missing schemas (exits with code 0 if no errors)

```bash
# See full validation output
cargo run -- validate v1.0

# Check exit code (0 = success, 1 = errors found)
echo $?
```

## Example Workflow

1. **Check current validation status:**

   ```bash
   cargo run -- validate v1.0
   ```

2. **Fix errors by adding required properties to TOML files**

3. **Re-validate:**

   ```bash
   cargo run -- validate v1.0
   ```

4. **Verify no errors:**
   ```bash
   cargo run -- validate v1.0 && echo "✓ Validation passed"
   ```
