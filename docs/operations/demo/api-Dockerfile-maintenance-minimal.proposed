FROM node:24.21.0-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl && npm install --global npm@11.19.0

FROM base AS deps
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/web/tools/next-lint-glob ./apps/web/tools/next-lint-glob/
RUN npm ci

FROM deps AS builder
COPY . .
RUN npm run db:generate --workspace @testimonial-cms/api
RUN npm run build --workspace @testimonial-cms/api

FROM base AS production-deps
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/web/tools/next-lint-glob ./apps/web/tools/next-lint-glob/
RUN npm ci --omit=dev --workspace @testimonial-cms/api --ignore-scripts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

FROM node:24.21.0-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /root/.npm
ENV NODE_ENV=production
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/apps ./apps
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/scripts/demo/config.mjs /app/scripts/demo/runtime.mjs /app/scripts/demo/preflight.mjs /app/scripts/demo/permissions.mjs ./scripts/demo/
USER node
EXPOSE 4000
CMD ["node", "--require", "./apps/api/dist/telemetry.js", "apps/api/dist/main.js"]

FROM builder AS maintenance-tools
RUN node scripts/release/collect-maintenance-tools.mjs /app /maintenance-tools

FROM runtime AS maintenance
COPY --from=maintenance-tools /maintenance-tools/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/warehouse ./apps/api/warehouse
COPY --from=builder /app/scripts/release ./scripts/release
WORKDIR /app/apps/api
ENTRYPOINT ["node"]
CMD ["-e", "process.stderr.write('Explicit maintenance command required\\n'); process.exit(1)"]

# Keep the default target identical to the production API runtime.
FROM runtime AS runner
