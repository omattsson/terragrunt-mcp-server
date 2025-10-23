# Use Node.js 24 Alpine for smaller image size
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy TypeScript configuration and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Install dev dependencies temporarily for build
RUN npm install --only=development

# Build TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create cache directory for documentation
RUN mkdir -p .cache/terragrunt-docs && \
    chown -R node:node .cache

# Switch to non-root user for security
USER node

# Expose port if needed for future HTTP/SSE transport
# EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Run the MCP server
CMD ["node", "dist/index.js"]
