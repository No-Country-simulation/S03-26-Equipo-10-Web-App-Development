FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN npm ci

FROM deps AS builder
COPY apps/api apps/api
RUN npm run build --workspace @testimonial-cms/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace", "@testimonial-cms/api"]
