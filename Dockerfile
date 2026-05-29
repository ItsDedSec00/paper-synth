# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build the Vite bundle
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack — matches the version we use locally.
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

# Install dependencies first (cached as long as the lockfile doesn't change).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest of the source and build.
COPY . .
RUN pnpm build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — serve the static dist with nginx
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
