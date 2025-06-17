# Stage 1: The build environment
# This stage installs dependencies and builds the React app
FROM node:20-alpine as builder

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

# Expose the port the proxy will run on (Render will map this)
EXPOSE 10000

# Use ENTRYPOINT to force Render to use the correct command.
# This starts the proxy, which will read all its configuration
# from the environment variables we set in render.yaml.
ENTRYPOINT ["/bin/oauth2-proxy"] 