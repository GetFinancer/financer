# syntax=docker/dockerfile:1
# Stage 1: Dependencies & Build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy all files
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Build the API
RUN pnpm --filter @financer/api build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copy built files and package.json
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./

# Remove workspace reference and install with npm (no symlinks)
RUN sed -i '/"@financer\/shared"/d' package.json && \
    npm install --omit=dev --ignore-scripts

# Create data directory
RUN mkdir -p /app/data && chown expressjs:nodejs /app/data

USER expressjs

EXPOSE 4000
ENV API_PORT=4000
ENV DATA_DIR=/app/data
ENV BASE_DOMAIN=getfinancer.com

CMD ["node", "dist/index.js"]
