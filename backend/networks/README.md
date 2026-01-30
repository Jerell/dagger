# Networks Directory

This directory contains network configurations that the backend API can access.

## Structure

Each network should be in its own subdirectory (e.g., `preset1/`, `demo/`).

## Usage

The API uses network names (not full paths) when querying:

- `GET /api/network?network=preset1` - uses `networks/preset1/`
- `GET /api/query?q=branch-4&network=preset1` - uses `networks/preset1/`

## Note

Paths are resolved relative to the backend directory where the server is running.
