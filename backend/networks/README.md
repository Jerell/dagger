# Networks Directory

This directory contains network configurations that the backend API can access.

## Structure

Each network should be in its own subdirectory (e.g., `preset1/`, `demo/`).

## Adding Networks

You can either:

1. Use the justfile command: `just setup-networks` (from project root)
2. Copy networks from the project root: `cp -r ../../network/preset1 ./`
3. Create symlinks: `ln -s ../../network/preset1 ./`
4. Create new networks directly in this directory

## Usage

The API uses network names (not full paths) when querying:

- `GET /api/network?network=preset1` - uses `networks/preset1/`
- `GET /api/query?q=branch-4&network=preset1` - uses `networks/preset1/`

## Note

Paths are resolved relative to the backend directory where the server is running.
