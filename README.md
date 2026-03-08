# Dagger

Dagger is a file-based network modeling workspace.

The current stack is:

- Rust `cli` for core parsing/query/schema logic and WASM builds
- Bun + Elysia + Effect in [backend](/Users/jerell/Repos/dagger/backend)
- React + TanStack + Electron in [frontend](/Users/jerell/Repos/dagger/frontend)

## Repo Layout

```text
dagger/
├── backend/    # Bun/Elysia API server
├── cli/        # Rust core and WASM source
├── frontend/   # React app + Electron shell
├── network/    # Example/preset networks
└── schemas/    # Schema generation/supporting assets
```

## Prerequisites

- Bun
- Rust
- `wasm-pack`
- `just` optional but recommended

## Setup

```bash
bun install
just setup
```

`just setup` installs workspace dependencies, copies DIM WASM assets, and prepares local network assets.

## Development

Default desktop flow:

```bash
just dev
```

Useful alternatives:

```bash
just dev-backend   # backend only
just dev-frontend  # Electron + renderer
just dev-web       # renderer in browser only
```

## Build And Check

```bash
just check-ts
```

Full repo check, including Rust CLI lint/tests:

```bash
just check
```

Direct build commands:

```bash
cd backend && bun run build
cd frontend && bun run build
```

Architecture and module docs live in [docs/index.md](/Users/jerell/Repos/dagger/docs/index.md).

Backend WASM rebuild:

```bash
just build-wasm
```

## Backend API

Main routes:

- `GET /health`
- `GET /api/query`
- `GET /api/network`
- `GET /api/schema`
- `POST /api/operations/costing/*`
- `POST /api/operations/snapshot/*`

Operation routes are grouped under `/api/operations`, and each operation module only owns its local segment.

## Notes

- The backend defaults to port `3000` for standalone runs.
- The Electron shell auto-starts the backend on port `3001` for desktop development.
- Operation upstream URLs such as costing and snapshot servers are configured inside their own modules via environment variables.
