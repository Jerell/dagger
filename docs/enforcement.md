# Architectural Enforcement

Rules from [core-beliefs.md](./core-beliefs.md) and [ARCHITECTURE.md](../ARCHITECTURE.md) that are enforced mechanically today.

All active rules run locally through `just check-ts` or `just check`.

## Active rules

### Rust formatting

`just format-check` runs `cargo fmt --check` in `cli/`.

### Rust lint and tests

`just lint` runs `cargo clippy`, and `just test-all` runs `cargo test --lib` in `cli/`.

### TypeScript lint

`just lint-ts` runs ESLint over the actively owned TypeScript layers:

- `backend/src/core/`
- `backend/src/dagger/`
- `frontend/src/`
- `frontend/electron/`

That lint currently enforces:

- no explicit `any`
- no unused variables unless intentionally prefixed with `_`

### Backend typecheck and tests

`just check-ts` runs:

- `cd backend && bun test`
- `cd backend && bun run build`

### Frontend production build

`just check-ts` runs `cd frontend && bun run build` to verify both renderer and Electron process builds.

### Docs freshness check

`scripts/check-docs-freshness.sh` verifies that [QUALITY_SCORE.md](./QUALITY_SCORE.md) references the major backend and frontend modules we expect to track.

### Test count drift check

`scripts/check-test-counts.sh` compares the documented backend TypeScript test count in [QUALITY_SCORE.md](./QUALITY_SCORE.md) with the real `bun test` result.

## Not Yet Enforced

These rules are documented but still manual:

- dependency direction inside backend TypeScript layers
- route-level coverage for query, network, schema, and snapshot modules
- Electron smoke coverage
- DIM artifact freshness against the external `dim` repo

## Philosophy

> "Enforce the boundaries that are expensive to rediscover."

The goal is not to mechanize every coding preference. The goal is to catch the drift that quietly damages the architecture: undocumented modules, stale test counts, avoidable type escapes, and broken build surfaces.
