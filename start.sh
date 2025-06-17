#!/bin/sh

# Render provides the PORT environment variable that our service should listen on.
# We set the proxy's http-address to listen on all interfaces (0.0.0.0)
# on the port Render has assigned.
export OAUTH2_PROXY_HTTP_ADDRESS="0.0.0.0:${PORT}"

# Hand off to the oauth2-proxy.
# It will automatically pick up this variable and all the others
# (like client id, secrets, etc.) that Render injects from the env group.
exec /bin/oauth2-proxy 