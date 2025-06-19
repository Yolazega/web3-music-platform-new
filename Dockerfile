# Multi-stage build
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the React app
RUN yarn build

# Production stage with oauth2-proxy
FROM alpine:latest

# Install oauth2-proxy and necessary tools
RUN apk add --no-cache bash coreutils curl && \
    curl -L -o /tmp/oauth2-proxy.tar.gz https://github.com/oauth2-proxy/oauth2-proxy/releases/download/v7.4.0/oauth2-proxy-v7.4.0.linux-amd64.tar.gz && \
    tar -xzf /tmp/oauth2-proxy.tar.gz -C /tmp && \
    mv /tmp/oauth2-proxy-v7.4.0.linux-amd64/oauth2-proxy /bin/oauth2-proxy && \
    chmod +x /bin/oauth2-proxy && \
    rm -rf /tmp/oauth2-proxy*

# Create oauth2-proxy user
RUN adduser -D -s /bin/sh oauth2-proxy

# Copy the built React app
COPY --from=builder /app/dist /var/www/html

# Create oauth2-proxy config directory and email whitelist
RUN mkdir -p /etc/oauth2-proxy
RUN echo 'robbescardanelli@gmail.com' > /etc/oauth2-proxy/emails.txt
RUN chown -R oauth2-proxy:oauth2-proxy /etc/oauth2-proxy

# Create a startup script that decodes the cookie secret
RUN cat <<'EOF' > /usr/local/bin/start.sh
#!/bin/sh
set -e

echo "Decoding cookie secret and setting environment..."

# Decode the secret from Render and export it with the name oauth2-proxy expects.
# The proxy requires the raw bytes, not the base64 string Render provides.
export OAUTH2_PROXY_COOKIE_SECRET=$(echo "$RENDER_GENERATED_COOKIE_SECRET" | base64 -d)

# Set all other configuration via environment variables
export OAUTH2_PROXY_HTTP_ADDRESS="0.0.0.0:4180"
export OAUTH2_PROXY_UPSTREAMS="file:///var/www/html#/"
export OAUTH2_PROXY_PROVIDER="github"
export OAUTH2_PROXY_SCOPE="user:email"
export OAUTH2_PROXY_EMAIL_DOMAINS="*"
export OAUTH2_PROXY_AUTHENTICATED_EMAILS_FILE="/etc/oauth2-proxy/emails.txt"
# OAUTH2_PROXY_CLIENT_ID and OAUTH2_PROXY_CLIENT_SECRET are already in the environment from Render

echo "Starting oauth2-proxy..."
exec /bin/oauth2-proxy --skip-jwt-bearer-tokens=true --skip-auth-preflight=true
EOF

# Make the startup script executable
RUN chmod +x /usr/local/bin/start.sh

# Switch back to oauth2-proxy user
USER oauth2-proxy

# Expose port
EXPOSE 4180

# Run the startup script
ENTRYPOINT ["/usr/local/bin/start.sh"] 