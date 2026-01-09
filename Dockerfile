# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy application files
COPY app/ ./app/
COPY ssl/ ./ssl/
COPY server.js ./
COPY package.json ./

# Install dependencies if needed
RUN npm install --production 2>/dev/null || true

# Expose HTTPS port
EXPOSE 3443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const https = require('https'); const options = { rejectUnauthorized: false }; https.get('https://localhost:3443', options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));" || exit 1

# Run the server
CMD ["node", "server.js"]
