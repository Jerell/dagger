# Dagger Backend

Bun/Elysia API server for Dagger.

## Stack

- Bun runtime
- Elysia for routing
- Effect for request flow and error handling

## Run

```bash
bun install
bun run dev
```

Standalone default URL:

```text
http://localhost:3000
```

## Build

```bash
bun run build
```

## Main Endpoints

- `GET /health`
- `GET /api/query?q=<query>&network=<path>`
- `GET /api/network?network=<path>`
- `GET /api/network/nodes?network=<path>&type=<type>`
- `GET /api/network/edges?network=<path>&source=<id>&target=<id>`
- `GET /api/network/list`
- `GET /api/schema`
- `GET /api/schema/:version`
- `GET /api/schema/network`
- `GET /api/schema/properties`
- `GET /api/schema/validate`
- `GET /api/schema/network/validate`
- `POST /api/schema/validate`

## Operations

All operation modules are mounted under `/api/operations`.

### Costing

- `POST /api/operations/costing/estimate`
- `POST /api/operations/costing/validate`
- `GET /api/operations/costing/libraries`
- `GET /api/operations/costing/libraries/:id`
- `GET /api/operations/costing/libraries/:id/modules`
- `GET /api/operations/costing/health`

Environment:

- `COSTING_SERVER_URL` default `http://localhost:8080`

### Snapshot

- `POST /api/operations/snapshot/validate`
- `POST /api/operations/snapshot/run`
- `POST /api/operations/snapshot/raw`
- `GET /api/operations/snapshot/health`

Environment:

- `SNAPSHOT_SERVER_URL` default `http://localhost:5000`

## WASM

The backend consumes WASM artifacts produced from [cli](/Users/jerell/Repos/dagger/cli).

```bash
just build-wasm
```
