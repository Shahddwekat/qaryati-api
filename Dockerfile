# Qaryati API image.
#
#   docker compose --profile app up --build     (see README, "Run everything in Docker")
#
# Two stages: "build" has every package (TypeScript, Prisma CLI, tsx) and is also
# used by the "migrate" service; "runtime" only has production packages and the
# compiled code, so the final image is smaller and has no build tools.

# ---------- 1. build ----------
FROM node:24-slim AS build
WORKDIR /app

# The Prisma CLI (migrations) needs OpenSSL, which the slim image does not include.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Install first (cached until package files, the Prisma schema or tsconfig change).
# `npm ci` also runs `prisma generate` (postinstall), which needs the schema and
# tsconfig.json (Prisma reads it to choose how the generated files import each other).
COPY package.json package-lock.json prisma7.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma ./prisma
RUN npm ci

COPY src ./src
RUN npm run build

# ---------- 2. runtime ----------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# The compiled app, including the generated Prisma client (dist/generated).
COPY --from=build /app/dist ./dist

# Do not run as root.
USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main"]
