FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/package.json

RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY apps/web apps/web
RUN npm run build --workspace @testimonial-cms/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
