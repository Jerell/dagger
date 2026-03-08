# Core Beliefs

Opinionated rules that keep `dagger` coherent. These are architecture constraints, not suggestions.

## Boundaries

1. **Reusable server primitives live in `backend/src/core/`.** New flow-network projects should reuse that layer and replace only project-specific modules.
2. **Project wiring lives in `backend/src/dagger/`.** If code is specific to Dagger network definitions, operations, or config, it belongs there instead of leaking into `core/`.
3. **Routes are thin.** Elysia modules validate input, call services, and return typed results. Business logic belongs in `backend/src/services/`.
4. **Operations compose under one root.** `/api/operations` is owned centrally; each operation module contributes only its local segment.

## Desktop

5. **Electron owns native capabilities.** File watching, filesystem access, and backend process management belong in `frontend/electron/`, not in the renderer.
6. **The preload bridge is the only renderer-native boundary.** Renderer code uses `frontend/src/lib/desktop.ts` and must not depend on Node globals directly.
7. **Desktop and web share one UI.** The React app should not fork into separate desktop-only and browser-only products.

## Runtime Integration

8. **DIM is an external dependency with local artifacts.** The source of truth is the separate `dim` repo; `dagger` vendors the built native and WASM outputs it needs.
9. **External operation services are adapters, not core state.** Costing and snapshot URLs are private concerns of their operation modules and should not shape the global app config.
10. **Network files are the source of truth.** The app edits TOML on disk; backend and frontend should avoid inventing alternate persistent stores for the same network model.

## Documentation

11. **Architecture knowledge must live in the repo.** Module boundaries, setup expectations, and integration contracts should be discoverable in version-controlled docs.
12. **Checks should enforce important drift.** If a doc or boundary matters enough to mention repeatedly, we should prefer a script or lint rule over relying on memory.
