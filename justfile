# Dagger project commands
# Install just: https://github.com/casey/just

default:
  @just --list

# Development
dev:
  # Start the backend server in development mode
  cd {{justfile_directory()}}/backend && npm run dev

dev-backend:
  cd {{justfile_directory()}}/backend && npm run dev

# Build commands
build-wasm:
  # Build Rust code to WebAssembly (Node.js target for file system access)
  cd {{justfile_directory()}}/cli && wasm-pack build --target nodejs --out-dir ../backend/pkg

build-wasm-release:
  # Build Rust code to WebAssembly (release mode, Node.js target)
  cd {{justfile_directory()}}/cli && wasm-pack build --release --target nodejs --out-dir ../backend/pkg

build-backend:
  # Build TypeScript backend
  cd {{justfile_directory()}}/backend && npm run build

# Test commands
test:
  # Run all Rust tests
  cd {{justfile_directory()}}/cli && cargo test

test-query:
  # Run query system tests
  cd {{justfile_directory()}}/cli && cargo test --lib query

test-parser:
  # Run parser tests
  cd {{justfile_directory()}}/cli && cargo test --lib parser

test-scope:
  # Run scope resolution tests
  cd {{justfile_directory()}}/cli && cargo test --lib scope

test-schema:
  # Run schema validation tests
  cd {{justfile_directory()}}/cli && cargo test --lib schema

test-all:
  # Run all tests (Rust)
  cd {{justfile_directory()}}/cli && cargo test --lib

# CLI commands
cli-export NETWORK="network/preset1":
  # Export network to JSON
  cd {{justfile_directory()}}/cli && cargo run -- export {{NETWORK}}

cli-query QUERY NETWORK="network/preset1":
  # Query the network
  cd {{justfile_directory()}}/cli && cargo run -- query "{{QUERY}}" {{NETWORK}}

cli-validate NETWORK="network/preset1" VERSION="1.0" SCHEMAS="schemas":
  # Validate network against schemas
  cd {{justfile_directory()}}/cli && cargo run -- validate --version {{VERSION}} {{NETWORK}} --schemas-dir {{SCHEMAS}}

cli-list NETWORK="network/preset1":
  # List all nodes in network
  cd {{justfile_directory()}}/cli && cargo run -- list {{NETWORK}}

# Linting and formatting
lint:
  # Run clippy on Rust code
  cd {{justfile_directory()}}/cli && cargo clippy

lint-fix:
  # Run clippy and auto-fix
  cd {{justfile_directory()}}/cli && cargo clippy --fix

format:
  # Format Rust code
  cd {{justfile_directory()}}/cli && cargo fmt

format-check:
  # Check Rust code formatting
  cd {{justfile_directory()}}/cli && cargo fmt --check

# Clean commands
clean:
  # Clean Rust build artifacts
  cd {{justfile_directory()}}/cli && cargo clean

clean-wasm:
  # Remove WASM build artifacts
  rm -rf {{justfile_directory()}}/backend/pkg

clean-all:
  # Clean all build artifacts
  just clean
  just clean-wasm
  cd {{justfile_directory()}}/backend && rm -rf dist node_modules

# Setup commands
setup:
  # Initial project setup
  cd {{justfile_directory()}}/cli && cargo build
  cd {{justfile_directory()}}/backend && npm install
  cd {{justfile_directory()}}/schemas && npm install
  just setup-networks

setup-backend:
  # Setup backend dependencies
  cd {{justfile_directory()}}/backend && npm install

setup-schemas:
  # Setup schema generation dependencies
  cd {{justfile_directory()}}/schemas && npm install

setup-networks:
  # Copy networks from project root to backend/networks
  mkdir -p {{justfile_directory()}}/backend/networks
  cp -r {{justfile_directory()}}/network/preset1 {{justfile_directory()}}/backend/networks/ || echo "Network preset1 already exists or not found"

# Full development workflow
dev-full:
  # Build WASM, generate schemas, and start backend
  @echo "Building WASM module..."
  just build-wasm
  @echo "Starting backend server..."
  just dev-backend

# Check everything
check:
  # Run all checks (format, lint, tests)
  just format-check
  just lint
  just test-all