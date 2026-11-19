# ANA Pattern Classifier - REST API (NestJS).
#
# On start the container applies pending database migrations, then starts the API:
#   docker run --env-file api.env -v ana-uploads:/app/uploads -p 8001:8001 <image>
# Create the first administrator once the API has started:
#   docker exec <container> node dist/scripts/create-admin-user.js
# Configuration comes from the environment (see env.example); no .env file is
# copied into the image.

# ---- build: compile TypeScript to dist/ -------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime: production dependencies and dist/ only -------------------------
FROM node:22-alpine AS runtime

# tini forwards SIGTERM to node so `docker stop` shuts the API down cleanly
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=8001 \
    UPLOADS_DIR=/app/uploads \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/dist ./dist

# Uploaded prediction images and the reference gallery live on a volume that
# the non-root user can write to
RUN mkdir -p /app/uploads/predictions /app/uploads/reference \
    && chown -R node:node /app/uploads
VOLUME ["/app/uploads"]

USER node
EXPOSE 8001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npm run --silent migration:run:prod && exec node dist/main.js"]
