# Stage 1: The build environment
# This stage installs dependencies and builds the React app
FROM node:18-alpine as builder

# Set the working directory
WORKDIR /app

# Copy package.json and yarn.lock to leverage Docker cache
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN yarn install

# Copy the rest of the application source code
COPY . .

# Build the application, creating the /app/dist directory
RUN yarn build

# Stage 2: The production environment
# This stage sets up the secure proxy and serves the built app
FROM quay.io/oauth2-proxy/oauth2-proxy:latest

# Copy the email whitelist and the proxy config template
# Note: We will generate the final config on startup
COPY email_list.txt /site_config/

# Copy the built static files from the 'builder' stage
COPY --from=builder /app/dist /app/

# Copy the configuration file that the proxy needs
COPY oauth2-proxy.cfg /etc/oauth2-proxy/oauth2-proxy.cfg

# Expose the port the proxy will run on
EXPOSE 80

# This is the command that starts the proxy
CMD ["/bin/oauth2-proxy", "--config", "/etc/oauth2-proxy/oauth2-proxy.cfg"] 