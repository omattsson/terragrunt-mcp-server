# Docker Deployment

This guide covers running the Terragrunt MCP Server using Docker, including both standalone containers and Docker Compose setups.

## Quick Start

### Using Pre-built Image

```bash
# Pull the latest image
docker pull omattsson/terragrunt-mcp-server:latest

# Run the container
docker run -i omattsson/terragrunt-mcp-server:latest
```

### Using Docker Compose

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f terragrunt-mcp-server

# Stop the service
docker-compose down
```

## Dockerfile Overview

The project includes a multi-stage Dockerfile optimized for production use:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY src ./src
RUN npm ci
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

### Key Features

- **Multi-stage build**: Reduces final image size
- **Alpine Linux**: Minimal base image
- **Production dependencies only**: No dev dependencies in final image
- **Non-root user**: Security best practice
- **Health checks**: Container health monitoring

## Building from Source

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+ (optional)

### Build Commands

```bash
# Build the Docker image
docker build -t terragrunt-mcp-server:local .

# Build with specific tag
docker build -t terragrunt-mcp-server:0.2.0 .

# Build without cache
docker build --no-cache -t terragrunt-mcp-server:local .
```

### Build Arguments

Customize the build with build arguments:

```bash
# Use different Node version
docker build --build-arg NODE_VERSION=20 -t terragrunt-mcp-server:local .

# Set working directory
docker build --build-arg WORKDIR=/opt/app -t terragrunt-mcp-server:local .
```

## Running the Container

### Basic Usage

```bash
# Interactive mode (for MCP communication)
docker run -i terragrunt-mcp-server:local

# With volume mount for cache persistence
docker run -i -v $(pwd)/.cache:/app/.cache terragrunt-mcp-server:local

# With environment variables
docker run -i -e LOG_LEVEL=debug terragrunt-mcp-server:local
```

### Important Flags

- `-i`: **Required** - Keeps stdin open for MCP stdio communication
- `-t`: Optional - Allocates a pseudo-TTY (not needed for MCP)
- `-v`: Optional - Mounts volumes for cache persistence

## Docker Compose Configuration

The included `docker-compose.yml` provides a complete setup:

```yaml
version: '3.8'

services:
  terragrunt-mcp-server:
    build:
      context: .
      dockerfile: Dockerfile
    image: terragrunt-mcp-server:latest
    container_name: terragrunt-mcp
    stdin_open: true  # Required for MCP stdio
    tty: true
    volumes:
      - ./.cache:/app/.cache  # Persist cache
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Configuration Options

#### Volumes

```yaml
volumes:
  - ./.cache:/app/.cache           # Cache persistence
  - ./fixtures:/app/fixtures:ro    # Custom fixtures (read-only)
  - ./logs:/app/logs              # Log output
```

#### Environment Variables

```yaml
environment:
  - NODE_ENV=production          # Production mode
  - LOG_LEVEL=info              # Logging level (debug|info|warn|error)
  - CACHE_DIR=/app/.cache       # Cache directory
  - CACHE_EXPIRY_HOURS=24       # Cache expiry time
```

#### Resource Limits

```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
```

## VS Code Integration with Docker

### Option 1: Direct Docker Command

Configure VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "${workspaceFolder}/.cache:/app/.cache",
        "terragrunt-mcp-server:latest"
      ]
    }
  }
}
```

### Option 2: Shell Script Wrapper

Create `scripts/docker-mcp.sh`:

```bash
#!/bin/bash
docker run -i --rm \
  -v "$(pwd)/.cache:/app/.cache" \
  terragrunt-mcp-server:latest
```

Configure VS Code:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "bash",
      "args": [
        "${workspaceFolder}/scripts/docker-mcp.sh"
      ]
    }
  }
}
```

### Option 3: Docker Compose

Start service separately:

```bash
docker-compose up -d
```

Then execute commands:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "docker-compose",
      "args": [
        "exec",
        "-T",
        "terragrunt-mcp-server",
        "node",
        "dist/index.js"
      ]
    }
  }
}
```

## Testing Docker Setup

### Using Test Script

The project includes `test-docker-mcp.sh`:

```bash
# Test MCP communication
./test-docker-mcp.sh

# This script:
# 1. Builds the Docker image
# 2. Sends test MCP requests
# 3. Validates responses
# 4. Cleans up
```

### Manual Testing

```bash
# Build the image
docker build -t terragrunt-mcp-server:test .

# Test MCP initialization
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | \
  docker run -i --rm terragrunt-mcp-server:test

# Expected output: JSON response with server capabilities
```

### Verify Health

```bash
# Check container health
docker ps --filter name=terragrunt-mcp --format "table {{.Names}}\t{{.Status}}"

# View logs
docker logs terragrunt-mcp-server

# Execute health check manually
docker exec terragrunt-mcp-server node -e "process.exit(0)"
```

## Cache Management in Docker

### Persistence Strategy

Mount cache directory for performance:

```bash
# Create cache directory
mkdir -p .cache/terragrunt-docs

# Run with mounted cache
docker run -i \
  -v $(pwd)/.cache:/app/.cache \
  terragrunt-mcp-server:latest
```

### Cache Lifecycle

1. **First run**: Fetches docs from web, saves to `/app/.cache`
2. **Subsequent runs**: Loads from mounted cache (~10ms)
3. **Cache refresh**: After 24 hours, automatic re-fetch

### Clearing Cache

```bash
# Stop container
docker-compose down

# Clear cache
rm -rf .cache/terragrunt-docs/*

# Restart
docker-compose up -d
```

## Multi-Platform Builds

Build for multiple architectures:

```bash
# Setup buildx
docker buildx create --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t omattsson/terragrunt-mcp-server:latest \
  --push \
  .
```

### Supported Platforms

- `linux/amd64` - x86_64 Linux (most common)
- `linux/arm64` - ARM64 Linux (Apple Silicon, AWS Graviton)
- `linux/arm/v7` - ARMv7 Linux (Raspberry Pi, etc.)

## Production Deployment

### Best Practices

1. **Use specific version tags**:
   ```bash
   docker pull omattsson/terragrunt-mcp-server:0.2.0
   ```

2. **Persist cache**:
   ```yaml
   volumes:
     - terragrunt-cache:/app/.cache
   ```

3. **Set resource limits**:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 512M
   ```

4. **Monitor health**:
   ```yaml
   healthcheck:
     test: ["CMD", "node", "-e", "process.exit(0)"]
   ```

5. **Use restart policies**:
   ```yaml
   restart: unless-stopped
   ```

### Security Considerations

```dockerfile
# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs
```

```yaml
# Security options
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
```

## Kubernetes Deployment

Example Kubernetes manifests:

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: terragrunt-mcp-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: terragrunt-mcp
  template:
    metadata:
      labels:
        app: terragrunt-mcp
    spec:
      containers:
      - name: server
        image: omattsson/terragrunt-mcp-server:0.2.0
        stdin: true
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        volumeMounts:
        - name: cache
          mountPath: /app/.cache
      volumes:
      - name: cache
        persistentVolumeClaim:
          claimName: terragrunt-cache-pvc
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: terragrunt-mcp-service
spec:
  selector:
    app: terragrunt-mcp
  ports:
  - protocol: TCP
    port: 3000
    targetPort: 3000
  type: ClusterIP
```

## Troubleshooting

### Container Exits Immediately

**Problem**: Container starts then exits

**Solution**: Ensure `-i` flag for stdin:
```bash
docker run -i terragrunt-mcp-server:latest
```

### Cache Not Persisting

**Problem**: Documentation refetches on every restart

**Solution**: Mount cache volume:
```bash
docker run -i -v $(pwd)/.cache:/app/.cache terragrunt-mcp-server:latest
```

### Build Failures

**Problem**: Docker build fails

**Solutions**:
```bash
# Clear build cache
docker builder prune

# Build without cache
docker build --no-cache -t terragrunt-mcp-server:local .

# Check Docker version
docker --version  # Should be 20.10+
```

### Network Issues

**Problem**: Can't fetch documentation

**Solutions**:
```bash
# Check internet connectivity
docker run -i terragrunt-mcp-server:latest sh -c "ping -c 3 google.com"

# Use host network
docker run -i --network=host terragrunt-mcp-server:latest

# Set DNS servers
docker run -i --dns 8.8.8.8 --dns 8.8.4.4 terragrunt-mcp-server:latest
```

### Permission Issues

**Problem**: Cache directory permission denied

**Solution**:
```bash
# Fix permissions
sudo chown -R $(id -u):$(id -g) .cache/

# Or run with user mapping
docker run -i -u $(id -u):$(id -g) \
  -v $(pwd)/.cache:/app/.cache \
  terragrunt-mcp-server:latest
```

## Performance Optimization

### Image Size Reduction

Current optimizations:
- Multi-stage build: ~150MB → ~100MB
- Alpine base: Smaller than debian
- Production deps only: Removes devDependencies

### Runtime Performance

```yaml
# Optimize for read-heavy workload
environment:
  - NODE_OPTIONS="--max-old-space-size=512"
```

### Network Optimization

```yaml
# DNS caching
dns:
  - 8.8.8.8
  - 8.8.4.4
```

## See Also

- [Installation Guide](Installation-Guide) - Standard installation
- [Configuration](Configuration) - Server configuration options
- [Troubleshooting](Troubleshooting) - Common issues
- [Development Guide](Development-Guide) - Contributing to the project
