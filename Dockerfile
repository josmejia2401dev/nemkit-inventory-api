# ─────────────────────────────────────────────
# nemkit-inventory-api — production image
# ─────────────────────────────────────────────
FROM node:24-alpine

# git is required at install time (nemkit is pulled from GitHub)
# dependency installation requires git to fetch nemkit from GitHub
RUN apk add --no-cache git openssh-client

WORKDIR /app

# Install dependencies.
# CACHEBUST invalidates this layer on demand so nemkit is re-pulled fresh
# from GitHub (its version isn't reflected in package.json changes).
# Build with:  docker build --build-arg CACHEBUST=$(date +%s) .
# On Render:   use "Clear build cache & deploy" to force a fresh install.
ARG CACHEBUST=1
COPY package*.json ./
RUN echo "cachebust=${CACHEBUST}" && npm ci --omit=dev

# Copy application source
COPY . .

# Render free tier uses ephemeral storage. Keep logs available while this
# instance is running and allow the non-root runtime user to write them.
RUN mkdir -p /app/logs \
    && chown node:node /app/logs

# Runtime environment
# NOTE: Render injects its own PORT env var at runtime — do not hardcode it.
# HOST must be 0.0.0.0 so the server accepts external connections.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    LOGS_LOCAL_PATH=/app/logs

# Informational only — Render detects the listening port automatically.
EXPOSE 4000

# Drop to non-root user for security
USER node

CMD ["node", "src/server.js"]
