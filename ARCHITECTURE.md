# Architecture

## System Overview

```text
┌──────────────────────────────────────────────────────────┐
│                    Electron Desktop App                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │         React + TanStack Frontend Renderer         │  │
│  │  - Network editor and watch mode                   │  │
│  │  - Operations UI and API client                    │  │
│  │  - Browser/server routes for web mode              │  │
│  └──────────────────────┬─────────────────────────────┘  │
│         Electron main/preload own native file access     │
│         and auto-start the backend in desktop mode       │
└─────────────────────────┼────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │     Elysia Server     │
              │     (Bun runtime)     │
              │  - Query/network API  │
              │  - Schema endpoints   │
              │  - Operation modules  │
              │  - DIM WASM bridge    │
              └───────────┬───────────┘
                          │
          ┌───────────────▼────────────────┐
          │         Rust / Zig Assets      │
          │  - Rust CLI core (`cli/`)      │
          │  - vendored `libdim_c.a`       │
          │  - DIM WASM in `dim/wasm/`     │
          └────────────────────────────────┘
                          │
          ┌───────────────▼────────────────┐
          │     External operation APIs    │
          │  - Costing server              │
          │  - Snapshot / modelling server │
          └────────────────────────────────┘
```

## Module Dependency Graph

Arrows mean "depends on". Only permitted high-level edges are shown.

```text
cli ──→ vendored dim native library (`cli/src/dim/libdim_c.a`)

backend/core ──→ elysia, effect
backend/dagger/modules ──→ backend/core
backend/dagger/modules ──→ backend/services
backend/services ──→ DIM WASM
backend/services/costing ──→ external costing server
backend/services/snapshot ──→ external snapshot server

frontend/renderer ──→ backend (HTTP)
frontend/renderer ──→ Electron preload bridge
frontend/electron ──→ backend (managed child process)
frontend/electron ──→ local filesystem
```

## Rules

1. `backend/src/core/` owns reusable HTTP and module composition primitives. Project-specific behavior belongs in `backend/src/dagger/`.
2. Query, network, schema, and operation modules stay thin. Validation, transforms, and upstream integration belong in `backend/src/services/`.
3. All operation routes are mounted under `/api/operations`. Individual operation modules only own their local prefix such as `/costing` or `/snapshot`.
4. Electron owns native concerns: backend lifecycle, file watching, directory picking, and file read/write. The renderer never reaches Node APIs directly.
5. Desktop mode and web mode share the same React application. Desktop-specific capabilities are accessed only through `frontend/src/lib/desktop.ts`.
6. DIM is external source code. `dagger` consumes built artifacts, not the DIM implementation itself.

## Backend Layers

```text
backend/src/
├── index.ts                     ← app composition and startup
├── core/                        ← reusable Elysia/Effect server primitives
│   ├── http.ts                  ← request helpers and HTTP error model
│   ├── operations.ts            ← module factories and /api/operations app
│   └── server.ts                ← root app creation and error handling
├── dagger/                      ← project wiring
│   ├── config.ts                ← runtime config and network path resolution
│   ├── adapters.ts              ← source adaptation helpers
│   └── modules/
│       ├── query.ts
│       ├── network.ts
│       ├── schema.ts
│       └── operations/
│           ├── costing.ts
│           └── snapshot.ts
└── services/                    ← business logic and upstream integration
```

### Backend rules

1. `core/` must remain reusable across future flow-network projects.
2. `dagger/` is the project layer. A new project should swap this layer, not fork `core/`.
3. Service modules may use Effect helpers and schemas internally, but route handlers should stay focused on boundary adaptation.
4. Operation upstream URLs are private module concerns. They do not belong in global server config.

## Frontend Layers

```text
frontend/
├── electron/
│   ├── main.ts                  ← desktop shell, backend process, file watching
│   └── preload.ts               ← safe IPC bridge
└── src/
    ├── routes/                  ← TanStack routes, including API proxy routes
    ├── components/              ← flow editor, dialogs, operations UI
    ├── contexts/                ← app-level state providers
    └── lib/
        ├── api-client.ts        ← backend HTTP client
        ├── desktop.ts           ← renderer bridge wrapper
        ├── operations/          ← operation registry and request helpers
        └── dim/                 ← frontend DIM WASM helpers
```

### Frontend rules

1. The renderer talks to native functionality only through the preload bridge.
2. Operation metadata belongs in `frontend/src/lib/operations/registry.ts`; UI reads from that registry rather than hardcoding routes in components.
3. Browser API routes under `frontend/src/routes/api/` proxy backend behavior for web mode and should not become an independent backend.

## Data Flow

| Concern | Primary format | Owner |
| --- | --- | --- |
| Network topology | TOML files | local filesystem |
| Desktop file changes | chokidar events | Electron main |
| Network API results | JSON over HTTP | Elysia backend |
| Costing requests/results | JSON over HTTP | costing operation + external costing API |
| Snapshot requests/results | JSON over HTTP | snapshot operation + external snapshot API |
| Unit parsing/conversion | WASM/native DIM calls | backend services, frontend DIM helpers, Rust CLI |

## Build And Run

| Command | What it does |
| --- | --- |
| `just dev` | Starts the Electron app and auto-starts backend in desktop mode |
| `just dev-backend` | Starts the Elysia backend standalone |
| `just dev-web` | Starts the frontend in browser-only mode |
| `just check-ts` | Runs TypeScript lint, backend tests/build, frontend build, docs guards |
| `just check` | Runs the full repo checks, including Rust formatting/lint/tests |
