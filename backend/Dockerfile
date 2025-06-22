# Use Node.js 18 Alpine for smaller image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with explicit cache settings
RUN npm ci --only=production --no-optional --no-fund --no-audit

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Install TypeScript and build dependencies temporarily
RUN npm install -g typescript
RUN npm install --only=dev --no-optional --no-fund --no-audit

# Build the application
RUN npm run build

# Remove dev dependencies and TypeScript after build
RUN npm prune --production
RUN npm uninstall -g typescript

# Copy any additional config files if needed
COPY *.json ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S axepuser -u 1001

# Change ownership of the app directory
RUN chown -R axepuser:nodejs /app
USER axepuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "run", "start"] 