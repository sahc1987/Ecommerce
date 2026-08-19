FROM node:20-alpine

WORKDIR /app

# System setup: install su-exec, create non-root user, and uploads directory in one layer
RUN apk add --no-cache su-exec curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 \
    && mkdir -p uploads \
    && chmod 755 uploads \
    && chown -R nodejs:nodejs /app

# Install production dependencies (own layer so it caches independently of source changes)
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application source code
COPY --chown=nodejs:nodejs src/ ./src/

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "src/index.js"]
