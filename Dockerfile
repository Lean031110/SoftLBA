# ============================================================
# SoftLBA — Dockerfile multi-stage
# ============================================================
# Construye una imagen de producción lista para desplegar.
#
# Arquitectura:
#   1. Base: oven/bun (runtime JavaScript rápido, compatible con Next.js)
#   2. deps: instala dependencias con bun (cacheable)
#   3. builder: genera el build standalone de Next.js + compila realtime service
#   4. runner: imagen final mínima con solo lo necesario para correr
#
# La imagen final NO incluye:
#   - node_modules de dev
#   - código fuente (.ts, .tsx)
#   - .next/cache
#   - herramientas de build
#
# Sí incluye:
#   - .next/standalone (server.js + dependencias mínimas)
#   - .next/static (assets estáticos)
#   - public/ (manifest, icons, sw.js)
#   - mini-services/realtime-service (compilado)
#   - prisma/ (para db push en runtime)
#   - db/ (SQLite, volumen persistente)
#
# Uso:
#   docker build -t softlba:latest .
#   docker compose up -d
# ============================================================

# --- Stage 1: Base ---
FROM oven/bun:1.3-debian AS base
WORKDIR /app

# --- Stage 2: Dependencies ---
FROM base AS deps
COPY package.json bun.lock ./
COPY mini-services/realtime-service/package.json ./mini-services/realtime-service/package.json

# Instalar dependencias del proyecto principal
RUN bun install --frozen-lockfile --production

# Instalar dependencias del realtime service
RUN cd mini-services/realtime-service && bun install --frozen-lockfile --production

# --- Stage 3: Builder ---
FROM base AS builder
WORKDIR /app

# Copiar dependencias instaladas
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mini-services/realtime-service/node_modules ./mini-services/realtime-service/node_modules

# Copiar código fuente
COPY . .

# Variables de entorno para el build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXTAUTH_SECRET=build-placeholder-min-16-chars

# Generar Prisma Client
RUN bun run db:generate

# Build de Next.js (standalone)
RUN bun run build

# Build del realtime service (compilar TypeScript a JavaScript)
RUN cd mini-services/realtime-service && bun build index.ts --outdir dist --target bun

# --- Stage 4: Runner (imagen final) ---
FROM oven/bun:1.3-slim AS runner
WORKDIR /app

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Crear usuario no-root para seguridad
RUN groupadd --system --gid 1001 softlba && \
    useradd --system --uid 1001 --gid softlba softlba

# Copiar build standalone de Next.js
COPY --from=builder --chown=softlba:softlba /app/.next/standalone ./
COPY --from=builder --chown=softlba:softlba /app/.next/static ./.next/static
COPY --from=builder --chown=softlba:softlba /app/public ./public

# Copiar realtime service compilado
COPY --from=builder --chown=softlba:softlba /app/mini-services/realtime-service/dist ./mini-services/realtime-service/dist
COPY --from=builder --chown=softlba:softlba /app/mini-services/realtime-service/node_modules ./mini-services/realtime-service/node_modules
COPY --from=builder --chown=softlba:softlba /app/mini-services/realtime-service/package.json ./mini-services/realtime-service/package.json

# Copiar Prisma (para db push en runtime)
COPY --from=builder --chown=softlba:softlba /app/prisma ./prisma
COPY --from=builder --chown=softlba:softlba /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=softlba:softlba /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder --chown=softlba:softlba /app/node_modules/prisma ./node_modules/prisma

# Copiar scripts (seed, backup)
COPY --from=builder --chown=softlba:softlba /app/scripts ./scripts

# Crear directorios para datos persistentes
RUN mkdir -p db download backups && chown -R softlba:softlba db download backups

# Cambiar a usuario no-root
USER softlba

# Exponer puertos
# 3000 = Next.js (web app)
# 3003 = Realtime service (Socket.IO)
EXPOSE 3000 3003

# Health check del servidor web
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Script de entrada que inicializa la DB y arranca ambos servicios
COPY --chown=softlba:softlba docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
