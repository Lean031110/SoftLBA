#!/bin/bash
# docker-entrypoint.sh
# ============================================================
# SoftLBA — Script de entrada para Docker
# ============================================================
# Ejecuta:
#   1. prisma db push (inicializa/migra la DB SQLite)
#   2. prisma db seed (datos demo si DB vacía)
#   3. Arranca el servicio realtime (Socket.IO) en background
#   4. Arranca el servidor Next.js (foreground)
#
# Si la variable INIT_DB=false, se omiten los pasos 1 y 2
# (útil para réplicas que comparten la misma DB).
# ============================================================

set -e

echo "============================================"
echo "  SoftLBA Docker Entrypoint"
echo "  Version: $(cat package.json | grep '"version"' | head -1 | awk -F'"' '{print $4}')"
echo "  Date: $(date)"
echo "============================================"

# Paso 1: Inicializar DB (si no está deshabilitado)
if [ "${INIT_DB:-true}" = "true" ]; then
  echo ""
  echo "[1/4] Inicializando base de datos..."
  npx prisma db push --accept-data-loss

  # Paso 2: Seed si la DB está vacía
  echo ""
  echo "[2/4] Verificando datos seed..."
  if [ "${SKIP_SEED:-false}" != "true" ]; then
    # Verificar si ya hay usuarios (evita re-seed)
    USER_COUNT=$(bun -e "
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient();
      p.user.count().then(c => { console.log(c); process.exit(0); }).catch(() => { console.log(0); process.exit(0); });
    " 2>/dev/null || echo "0")

    if [ "$USER_COUNT" = "0" ]; then
      echo "  DB vacía — ejecutando seed..."
      bun run scripts/seed.ts || echo "  Seed falló (no crítico)"
    else
      echo "  DB ya tiene $USER_COUNT usuarios — saltando seed."
    fi
  fi
else
  echo ""
  echo "[1/4] Inicialización de DB deshabilitada (INIT_DB=false)"
  echo "[2/4] Seed deshabilitado"
fi

# Paso 3: Arrancar servicio realtime en background
# v1.1.0-rc1: verificar que socket.io está instalado antes de arrancar.
echo ""
echo "[3/4] Arrancando servicio Realtime (Socket.IO) en puerto ${REALTIME_PORT:-3003}..."
cd /app/mini-services/realtime-service

# Verificar dependencias del realtime service
if [ ! -d "node_modules/socket.io" ]; then
  echo "  Instalando dependencias del realtime service..."
  bun install --production 2>/dev/null || npm install --production 2>/dev/null || echo "  WARN: no se pudieron instalar deps del realtime"
fi

# Verificar que el build existe
if [ ! -f "dist/index.js" ]; then
  echo "  Compilando realtime service..."
  bun build index.ts --outdir dist --target bun 2>/dev/null || npx tsc 2>/dev/null || echo "  WARN: no se pudo compilar realtime"
fi

# Arrancar realtime service
if [ -f "dist/index.js" ]; then
  bun run dist/index.js &
  REALTIME_PID=$!
  echo "  Realtime PID: $REALTIME_PID"
elif [ -f "index.ts" ]; then
  # Fallback: ejecutar TypeScript directamente con bun
  bun run index.ts &
  REALTIME_PID=$!
  echo "  Realtime PID: $REALTIME_PID (modo TypeScript directo)"
else
  echo "  ERROR: No se encontró el código del realtime service."
  echo "  El servidor web arrancará sin realtime (las notificaciones push no funcionarán)."
  REALTIME_PID=""
fi

# Volver al directorio principal
cd /app

# Paso 4: Arrancar servidor Next.js (foreground)
echo ""
echo "[4/4] Arrancando servidor Next.js en puerto ${PORT:-3000}..."
echo ""

# Usar el server.js del standalone build
exec node .next/standalone/server.js
