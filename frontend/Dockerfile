# ANA Pattern Classifier - web frontend (React SPA served by nginx, non-root).
#
# Build (values are inlined into the JavaScript bundle at build time):
#   docker build -t ana-web \
#     --build-arg REACT_APP_API_BASE_URL=http://localhost:8001/api/v1 \
#     --build-arg REACT_APP_LAB_NAME="Clinical Immunology Laboratory" frontend
# Run (API_ORIGIN = origin of REACT_APP_API_BASE_URL, allowed by the CSP connect-src):
#   docker run -p 3000:8080 -e API_ORIGIN=http://localhost:8001 ana-web

# ---- build: static bundle ----------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tailwind.config.js postcss.config.js ./
COPY public ./public
COPY src ./src

# CRA inlines every REACT_APP_* variable present in the build environment (a dependency
# references `process.env` as a whole). Only these whitelisted build args exist here:
# no .env file is copied (.dockerignore) and they do not reach the runtime image.
ARG REACT_APP_API_BASE_URL=http://localhost:8001/api/v1
ARG REACT_APP_LAB_NAME="Clinical Immunology Laboratory"
ARG REACT_APP_LAB_DEPARTMENT="Special Immunology"
ARG REACT_APP_LAB_ADDRESS=""

# INLINE_RUNTIME_CHUNK=false keeps every script in a file, so the CSP needs no 'unsafe-inline'.
RUN GENERATE_SOURCEMAP=false INLINE_RUNTIME_CHUNK=false npm run build

# ---- runtime: nginx as an unprivileged user on port 8080 --------------------
FROM nginxinc/nginx-unprivileged:alpine

ENV API_ORIGIN=http://localhost:8001

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
