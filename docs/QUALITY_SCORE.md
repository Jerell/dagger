# Quality Score

Per-area quality assessment for the current TypeScript server and desktop stack.

Last updated: 2026-03-08

## Grading

- **A** — Well-tested, stable API, no known gaps
- **B** — Functional with tests, minor gaps or edge cases
- **C** — Works but under-tested or has known limitations
- **D** — Incomplete or missing significant functionality
- **F** — Not started

## Backend

| Area | Grade | Tests | Notes |
| --- | --- | --- | --- |
| **Server core** (`backend/src/core/http.ts`, `backend/src/core/server.ts`, `backend/src/core/operations.ts`) | B | Indirect | Shared Elysia/Effect request flow is exercised through service and route usage. Missing direct route-level tests. |
| **App wiring** (`backend/src/index.ts`, `backend/src/dagger/config.ts`) | B | Indirect | Composition is simple and typechecked, but not directly integration-tested. |
| **Query and network modules** (`backend/src/dagger/modules/query.ts`, `backend/src/dagger/modules/network.ts`) | C | 0 | Core functionality exists but route-level coverage is missing. |
| **Schema module** (`backend/src/dagger/modules/schema.ts`) | C | 0 | Broad behavior exists but has no dedicated automated tests yet. |
| **Costing operation** (`backend/src/dagger/modules/operations/costing.ts`, `backend/src/services/costing/`) | B | 62 | Best-covered backend area. Adapter, lookup, schemas, and integration path are tested. |
| **Snapshot operation** (`backend/src/dagger/modules/operations/snapshot.ts`, `backend/src/services/snapshot/`) | C | 0 | Live request/transform path exists, but there are no dedicated tests yet. |
| **Validation and schema services** (`backend/src/services/effectValidation.ts`, `backend/src/services/effectSchemaProperties.ts`, `backend/src/services/effectSchemas.ts`) | C | 0 | Important core behavior, currently relying on manual validation and transitive coverage. |
| **Network/query services** (`backend/src/services/network.ts`, `backend/src/services/query.ts`) | C | 0 | Used heavily but missing direct tests in the Bun/Elysia layer. |
| **Utilities** (`backend/src/utils/network-path.ts`, `backend/src/utils/getDagger.ts`) | C | 0 | Small surface area, but still undocumented by tests. |

**Total TypeScript tests: 62**

## Frontend

| Area | Grade | Tests | Notes |
| --- | --- | --- | --- |
| **Electron shell** (`frontend/electron/main.ts`, `frontend/electron/preload.ts`, `frontend/src/lib/desktop.ts`) | C | 0 | Builds cleanly, but there is no automated desktop smoke coverage yet. |
| **Network editor flow** (`frontend/src/routes/network/`, `frontend/src/components/flow/`) | C | 0 | Main user-facing surface. Verified by build only. |
| **Operations UI** (`frontend/src/components/operations/`, `frontend/src/lib/operations/`) | C | 0 | Functional but currently untested. |
| **API proxy/client layer** (`frontend/src/lib/api-client.ts`, `frontend/src/lib/api-proxy.ts`) | C | 0 | No automated coverage yet. |

## Cross-Cutting Concerns

| Concern | Grade | Notes |
| --- | --- | --- |
| **Type safety** | B | Strict TypeScript is enabled in backend and frontend, with lint enforcing `no-explicit-any` outside allowed exceptions. |
| **Documentation freshness** | B | Guarded by `scripts/check-docs-freshness.sh` against major backend module drift. |
| **Test count drift** | B | Guarded by `scripts/check-test-counts.sh` for backend Bun tests. |
| **Repo checks** | B | `just check` now covers Rust formatting/linting/tests plus TypeScript lint/build/test/doc guards. |

## Priority Gaps

1. Add backend route-level tests for query, network, schema, and health endpoints.
2. Add snapshot service/operation tests comparable to the costing coverage.
3. Add frontend tests for network watch mode, file export, and Electron bridge behavior.
