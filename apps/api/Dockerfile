# Stage 1: Base and Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
# Install OpenSSL for Prisma
RUN apk add --no-cache openssl
# Copy root workspace files
COPY package.json package-lock.json ./
# Copy workspace apps package.json to install dependencies correctly
COPY apps/api/package.json ./apps/api/
# Install dependencies (KISS: using clean install)
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma Client
RUN cd apps/api && npx prisma generate
# Build the NestJS app
RUN npm run build -w @testimonial-cms/api

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Copy node_modules and Prisma schema/client
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Use nonroot user for security
USER node

EXPOSE 4000

# Start the application
CMD ["node", "apps/api/dist/main.js"]
