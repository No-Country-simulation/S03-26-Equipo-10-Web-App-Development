FROM node:24.21.0-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl && npm install --global npm@11.19.0

FROM base AS deps
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci

FROM deps AS builder
COPY . .
RUN npm run db:generate --workspace @testimonial-cms/api
RUN npm run build --workspace @testimonial-cms/api

FROM base AS production-deps
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --omit=dev --workspace @testimonial-cms/api --ignore-scripts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

FROM base AS runner
ENV NODE_ENV=production
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/apps ./apps
COPY --from=builder /app/apps/api/dist ./apps/api/dist
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
