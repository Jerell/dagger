# Dagger Frontend

React/TanStack frontend with an Electron desktop shell.

## Modes

Desktop development:

```bash
bun run dev
```

Browser-only development:

```bash
bun run dev:web
```

Production build:

```bash
bun run build
```

This builds:

- the web renderer via Vite/TanStack Start
- the Electron main/preload code into `dist-electron/`

## Desktop Bridge

The renderer talks to Electron through [src/lib/desktop.ts](/Users/jerell/Repos/dagger/frontend/src/lib/desktop.ts).

That bridge owns:

- backend process startup/shutdown
- native directory picker
- TOML file read/write/delete operations
- directory watching for live network reload

## Backend Expectations

- Desktop mode expects the backend on `http://127.0.0.1:3001`
- Browser/server routes still proxy through the frontend API layer

## Testing

```bash
bun run test
```
