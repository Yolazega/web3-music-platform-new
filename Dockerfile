# Use the official oauth2-proxy image as our base
FROM quay.io/oauth2-proxy/oauth2-proxy

# Copy our email whitelist into the container
COPY email_list.txt /site_config/

# Copy the built static files from our frontend project into the container
# The 'dist' directory contains the output of 'yarn build'
COPY dist /app/

# This is the command that starts the proxy
# It tells the proxy to use GitHub, protect the files in /app/,
# and check emails against our list.
ENTRYPOINT ["/bin/oauth2-proxy", \
            "--provider", "github", \
            "--upstream", "file:///app/#/", \
            "--authenticated-emails-file", "/site_config/email_list.txt", \
            "--scope=user:email", \
            "--cookie-expire=24h", \
            "--session-cookie-minimal=true", \
            "--skip-provider-button=true", \
            "--http-address", ":10000"] 