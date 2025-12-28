# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps

# Copy root workspace package.json
COPY package.json ./

# Copy backend package files (needed for workspace dependency / type imports)
COPY backend/package.json backend/tsconfig.json ./backend/
COPY backend/src/ ./backend/src/

# Copy frontend package files
COPY frontend/package.json frontend/bun.lock ./frontend/

# Install frontend dependencies
WORKDIR /app/frontend
RUN bun install --frozen-lockfile

# ---- Development ----
FROM deps AS dev
WORKDIR /app/frontend

# Copy frontend source
COPY frontend/ ./

# Copy dim WASM module (only in public for browser access)
COPY frontend/public/dim/ ./public/dim/

EXPOSE 3000

ENV NODE_ENV=development

# Development: run vite dev server with hot reload
CMD ["bun", "run", "dev"]

# ---- Build ----
FROM deps AS builder
WORKDIR /app/frontend

# Copy frontend source
COPY frontend/ ./

# Copy dim WASM module (only in public for browser access)
COPY frontend/public/dim/ ./public/dim/

# Build arguments for environment variables (baked into build)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the application
RUN bun run build

# ---- Production ----
FROM base AS production
WORKDIR /app

# Copy built output
COPY --from=builder /app/frontend/.output ./.output

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Run the production server
CMD ["bun", "run", ".output/server/index.mjs"]
