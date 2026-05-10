# Use official Node.js LTS image
FROM node:20-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3443

# Create app directory and a non-root user/group
WORKDIR /app
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp

# Copy package manifests first for better Docker layer caching
COPY --chown=nodeapp:nodeapp package*.json ./

# Install only production dependencies (deterministic if lockfile exists)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && npm cache clean --force

# Copy application sources
COPY --chown=nodeapp:nodeapp app/ ./app/
COPY --chown=nodeapp:nodeapp server.js ./

# SSL certificates should be mounted at runtime, NOT baked into the image.
# Example: docker run -v $(pwd)/ssl:/app/ssl:ro ...
VOLUME ["/app/ssl"]

EXPOSE 3443

# Health check (uses HEAD; tolerates self-signed certs in dev)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const m=require('https');const r=m.request({host:'127.0.0.1',port:process.env.PORT||3443,path:'/',method:'HEAD',rejectUnauthorized:false},res=>process.exit(res.statusCode<500?0:1));r.on('error',()=>process.exit(1));r.end();"

# Drop privileges
USER nodeapp

CMD ["node", "server.js"]
