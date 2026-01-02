# Dagger project commands
# Install just: https://github.com/casey/just

default:
  @just --list

# Quick reference:
#   just dev          - Start Tauri app (recommended for development)
#   just dev-backend  - Start backend server standalone
#   just dev-frontend - Start frontend dev server standalone (browser)

# Development
# Start Tauri app (includes frontend dev server and backend via Tauri)
dev:
  @just kill-dev || true
  cd {{justfile_directory()}}/frontend && bun tauri dev

# Kill any stale dev processes (vite, tauri)
kill-dev:
  @echo "Killing stale dev processes..."
  -pkill -f "vite dev" || true
  -pkill -f "tauri dev" || true
  @echo "Done"

# Start backend server standalone (for testing API directly)
dev-backend:
  cd {{justfile_directory()}}/backend && bun run dev

# Start frontend dev server standalone (for browser testing)
dev-frontend:
  cd {{justfile_directory()}}/frontend && bun run dev

# Build commands
build-wasm:
  # Build Rust code to WebAssembly (Node.js target for file system access)
  cd {{justfile_directory()}}/cli && wasm-pack build --target nodejs --out-dir ../backend/pkg

build-wasm-release:
  # Build Rust code to WebAssembly (release mode, Node.js target)
  cd {{justfile_directory()}}/cli && wasm-pack build --release --target nodejs --out-dir ../backend/pkg

build-backend:
  # Build TypeScript backend
  cd {{justfile_directory()}}/backend && bun run build

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
  cd {{justfile_directory()}}/backend && bun install
  cd {{justfile_directory()}}/frontend && bun install
  cd {{justfile_directory()}}/schemas && bun install
  just setup-networks
  just setup-dim
  just setup-tauri

setup-backend:
  # Setup backend dependencies
  cd {{justfile_directory()}}/backend && bun install

setup-frontend:
  # Setup frontend dependencies (including Tauri)
  cd {{justfile_directory()}}/frontend && bun install

setup-tauri:
  # Setup Tauri Rust dependencies
  cd {{justfile_directory()}}/frontend/src-tauri && cargo build

setup-schemas:
  # Setup schema generation dependencies
  cd {{justfile_directory()}}/schemas && bun install

setup-networks:
  # Copy networks from project root to backend/networks
  mkdir -p {{justfile_directory()}}/backend/networks
  cp -r {{justfile_directory()}}/network/preset1 {{justfile_directory()}}/backend/networks/ || echo "Network preset1 already exists or not found"

setup-dim:
  # Copy dim WASM files to backend and frontend directories
  mkdir -p {{justfile_directory()}}/backend/dim/wasm
  mkdir -p {{justfile_directory()}}/frontend/public/dim
  cp {{justfile_directory()}}/dim/wasm/*.wasm {{justfile_directory()}}/backend/dim/wasm/ 2>/dev/null || echo "Dim WASM files not found in dim/wasm/"
  cp {{justfile_directory()}}/dim/wasm/*.wasm {{justfile_directory()}}/frontend/public/dim/ 2>/dev/null || echo "Dim WASM files not found in dim/wasm/"

# Full development workflow
dev-full:
  # Build WASM, copy dim files, and start Tauri app
  @echo "Building WASM module..."
  just build-wasm
  @echo "Setting up dim WASM files..."
  just setup-dim
  @echo "Starting Tauri app..."
  just dev

# Check everything
check:
  # Run all checks (format, lint, tests)
  just format-check
  just lint
  just test-all