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

# Create oauth2-proxy config directory
RUN mkdir -p /etc/oauth2-proxy

# Create the oauth2-proxy configuration file
RUN echo '# OAuth2 Proxy Configuration' > /etc/oauth2-proxy/oauth2-proxy.cfg && \
    echo 'http_address = "0.0.0.0:4180"' >> /etc/oauth2-proxy/oauth2-proxy.cfg && \
    echo 'upstreams = ["file:///var/www/html#/"]' >> /etc/oauth2-proxy/oauth2-proxy.cfg && \
    echo 'cookie_name = "_oauth2_proxy"' >> /etc/oauth2-proxy/oauth2-proxy.cfg && \
    echo 'cookie_secure = true' >> /etc/oauth2-proxy/oauth2-proxy.cfg && \
    echo 'cookie_httponly = true' >> /etc/oauth2-proxy/oauth2-proxy.cfg && \
    echo 'cookie_samesite = "lax"' >> /etc/oauth2-proxy/oauth2-proxy.cfg && \
    echo 'provider = "github"' >> /etc/oauth2-proxy/oauth2-proxy.cfg && \
    echo 'scope = "user:email"' >> /etc/oauth2-proxy/oauth2-proxy.cfg && \
    echo 'email_domains = ["*"]' >> /etc/oauth2-proxy/oauth2-proxy.cfg && \
    echo 'authenticated_emails_file = "/etc/oauth2-proxy/emails.txt"' >> /etc/oauth2-proxy/oauth2-proxy.cfg && \
    echo 'skip_provider_button = false' >> /etc/oauth2-proxy/oauth2-proxy.cfg

# Create the email whitelist file
RUN echo 'robbescardanelli@gmail.com' > /etc/oauth2-proxy/emails.txt

# Switch back to oauth2-proxy user
USER oauth2-proxy

# Expose port
EXPOSE 4180

# Use the oauth2-proxy binary as entrypoint.
# The command will be provided by Render's dockerCommand.
ENTRYPOINT ["/bin/oauth2-proxy"] 