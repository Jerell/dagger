# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base
WORKDIR /app

# Copy root workspace package.json
COPY package.json ./

# Copy backend package files
COPY backend/package.json backend/bun.lock ./backend/

# ---- Development ----
FROM base AS dev
WORKDIR /app/backend

# Install all dependencies (including devDependencies)
RUN bun install --frozen-lockfile

# Copy backend source code
COPY backend/src/ ./src/
COPY backend/tsconfig.json ./
COPY backend/pkg/ ./pkg/
COPY backend/dim/ ./dim/
COPY backend/networks/ ./networks/

EXPOSE 3001

ENV NODE_ENV=development
ENV PORT=3001

# Development: run with hot reload
CMD ["bun", "run", "--hot", "src/index.ts"]

# ---- Production ----
FROM base AS production
WORKDIR /app/backend

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Copy backend source code
COPY backend/src/ ./src/
COPY backend/tsconfig.json ./
COPY backend/dist/ ./dist/
COPY backend/pkg/ ./pkg/
COPY backend/dim/ ./dim/
COPY backend/networks/ ./networks/

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# Production: start server
CMD ["bun", "run", "start"]
