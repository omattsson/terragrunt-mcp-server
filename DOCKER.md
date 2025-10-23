# Docker Setup for Terragrunt MCP Server

This document describes how to build and run the Terragrunt MCP server using Docker.

## Prerequisites

- Docker 20.10 or later
- Docker Compose (optional, for easier management)

## Building the Image

### Using npm script:
```bash
npm run docker:build
```

### Using docker directly:
```bash
docker build -t terragrunt-mcp-server:latest .
```

## Running the Container

### Using Docker Run (stdio mode):
```bash
docker run -i terragrunt-mcp-server:latest
```

For persistent cache:
```bash
docker run -i \
  -v mcp-cache:/app/.cache \
  terragrunt-mcp-server:latest
```

### Using Docker Compose:
```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

Or use npm scripts:
```bash
npm run docker:compose:up
npm run docker:compose:logs
npm run docker:compose:down
```

## VS Code Integration with Docker

To use the Dockerized MCP server with VS Code, update your `.vscode/mcp.json`:

```json
{
  "servers": {
    "terragrunt": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v", "mcp-cache:/app/.cache",
        "terragrunt-mcp-server:latest"
      ]
    }
  }
}
```

## Testing the Container

Test that the server works:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | docker run -i terragrunt-mcp-server:latest
```

## Container Details

- **Base Image**: `node:24-alpine`
- **Working Directory**: `/app`
- **User**: `node` (non-root for security)
- **Cache Location**: `/app/.cache/terragrunt-docs/`
- **Entry Point**: `node dist/index.js`

## Volume Management

The container uses a named volume for caching documentation:

```bash
# Inspect the cache volume
docker volume inspect mcp-cache

# Remove the cache (will be rebuilt on next run)
docker volume rm mcp-cache
```

## Image Size

The image is optimized for size:
- Uses Alpine Linux base (~50MB)
- Multi-stage build removes dev dependencies
- Only production dependencies included
- Expected final size: ~150-200MB

## Troubleshooting

### Permission Issues
The container runs as the `node` user. If you have permission issues with volumes:
```bash
docker run -i -u node terragrunt-mcp-server:latest
```

### Cache Not Persisting
Ensure you're using a volume:
```bash
docker run -i -v mcp-cache:/app/.cache terragrunt-mcp-server:latest
```

### Build Fails
Clean and rebuild:
```bash
docker system prune -f
docker build --no-cache -t terragrunt-mcp-server:latest .
```

## Development Mode

For development with hot reload, mount your local source:
```bash
docker run -i \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/dist:/app/dist \
  -v mcp-cache:/app/.cache \
  terragrunt-mcp-server:latest
```

## Security Considerations

- Container runs as non-root user (`node`)
- Only production dependencies included
- No unnecessary ports exposed (stdio only)
- Alpine base reduces attack surface
- Documentation cache is the only writable volume

## Publishing the Image

If you want to publish to a container registry:

```bash
# Tag for registry
docker tag terragrunt-mcp-server:latest ghcr.io/omattsson/terragrunt-mcp-server:latest

# Push to GitHub Container Registry
docker push ghcr.io/omattsson/terragrunt-mcp-server:latest
```
