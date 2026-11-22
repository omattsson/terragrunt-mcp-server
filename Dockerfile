# syntax=docker/dockerfile:1

# ---- Build stage: compile TypeScript with dev dependencies ----
FROM node:26-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ---- Runtime stage: production dependencies plus runtime data ----
FROM node:26-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
# Read at runtime: backend schema templates and the offline docs fallback
COPY schemas/ ./schemas/
COPY fixtures/ ./fixtures/
COPY bin/ ./bin/

# Docs cache and metrics live outside the install directory so the image works
# with --read-only plus a volume or tmpfs mounted at /cache.
ENV NODE_ENV=production \
    TERRAGRUNT_MCP_CACHE_DIR=/cache/docs \
    TERRAGRUNT_MCP_METRICS_DIR=/cache/metrics
RUN mkdir -p /cache && chown node:node /cache
VOLUME ["/cache"]

# Run as non-root
USER node

CMD ["node", "dist/index.js"]
