FROM node:24-alpine AS builder

WORKDIR /app

# Empty = use the relative /api path that nginx proxies (see src/config.ts).
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runs as the non-root nginx user out of the box, so it listens on 8080 (ports
# below 1024 need root).
FROM nginxinc/nginx-unprivileged:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/health || exit 1
