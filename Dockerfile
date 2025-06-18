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

# Create a startup script
RUN printf '#!/bin/sh\n\
set -e\n\
\n\
# Create the config file from environment variables\n\
echo "Writing oauth2-proxy config file..."\n\
cat <<EOF > /etc/oauth2-proxy/oauth2-proxy.cfg\n\
http_address = "0.0.0.0:4180"\n\
upstream = "file:///var/www/html#/"\n\
provider = "github"\n\
scope = "user:email"\n\
email_domain = "*"\n\
authenticated_emails_file = "/etc/oauth2-proxy/emails.txt"\n\
\n\
# These are injected by Render\n\
client_id = \\"$OAUTH2_PROXY_CLIENT_ID\\"\n\
client_secret = \\"$OAUTH2_PROXY_CLIENT_SECRET\\"\n\
cookie_secret = \\"$OAUTH2_PROXY_COOKIE_SECRET\\"\n\
EOF\n\
\n\
echo "Starting oauth2-proxy..."\n\
exec /bin/oauth2-proxy --config=/etc/oauth2-proxy/oauth2-proxy.cfg\n\
' > /usr/local/bin/start.sh

# Make the startup script executable
RUN chmod +x /usr/local/bin/start.sh

# Switch back to oauth2-proxy user
USER oauth2-proxy

# Expose port
EXPOSE 4180

# Run the startup script
ENTRYPOINT ["/usr/local/bin/start.sh"] 