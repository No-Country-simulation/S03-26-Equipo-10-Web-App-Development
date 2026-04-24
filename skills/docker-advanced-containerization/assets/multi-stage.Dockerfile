# Ejemplo de Dockerfile Multi-Stage Optimizado (Node.js)
# Skill: SKL-PRO-002

# --- ETAPA 1: Build ---
FROM node:20-alpine AS builder

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias solo para compilación
COPY package*.json ./
RUN npm ci

# Copiar código fuente y compilar
COPY . .
RUN npm run build

# --- ETAPA 2: Runtime (Producción) ---
# Usamos una base ligera y segura
FROM node:20-alpine AS runner

WORKDIR /app

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar artefactos desde la etapa de build
COPY --from=builder /app/dist ./dist

# SEGURIDAD: Ejecutar como usuario no raíz
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
USER nextjs

# Metadatos y etiquetas
LABEL maintainer="Equipo 10"
LABEL version="1.0.0"

# Exponer puerto
EXPOSE 3000

# Salud del contenedor
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Comando de inicio
CMD ["node", "dist/main.js"]
