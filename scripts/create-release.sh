#!/usr/bin/env bash
# scripts/create-release.sh
# v1.1.0-rc1: Crea un paquete de release reproducible.
# NO incluye: download/, upload/, backups/, db/, logs, .next/, test-results/, node_modules/
set -euo pipefail

VERSION=$(grep '"version"' package.json | head -1 | awk -F'"' '{print $4}')
DATE=$(date +%Y-%m-%d)
RELEASE_NAME="SoftLBA-${VERSION}-${DATE}"
TAR_FILE="${RELEASE_NAME}.tar.gz"

echo "============================================"
echo "  SoftLBA Release Packager"
echo "  Version: $VERSION"
echo "  Date: $DATE"
echo "  Output: $TAR_FILE"
echo "============================================"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  echo "ERROR: No se encontró package.json. Ejecuta desde la raíz del proyecto."
  exit 1
fi

# Crear tar excluyendo todo lo no necesario
echo ""
echo "Empaquetando..."
tar -czf "$TAR_FILE" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='download' \
  --exclude='upload' \
  --exclude='backups' \
  --exclude='db/*.db' \
  --exclude='db/*.db-*' \
  --exclude='*.log' \
  --exclude='test-results' \
  --exclude='playwright-report' \
  --exclude='tests/e2e/screenshots/*.png' \
  --exclude='skills' \
  --exclude='agent-ctx' \
  --exclude='tool-results' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='*.tar.gz' \
  --exclude='*.zip' \
  -C "$(dirname "$(pwd)")" "$(basename "$(pwd)")"

echo ""
echo "============================================"
echo "  ✓ Paquete creado: $TAR_FILE"
echo "  Tamaño: $(du -sh "$TAR_FILE" | awk '{print $1}')"
echo ""
echo "  Contenido del paquete:"
echo "    - Código fuente (src/)"
echo "    - Prisma schema"
echo "    - Docker (Dockerfile, docker-compose.yml)"
echo "    - Tests (unit, integration, e2e)"
echo "    - Documentación (docs/)"
echo "    - Scripts"
echo "    - Deploy (linux/windows)"
echo ""
echo "  NO incluye:"
echo "    - node_modules"
echo "    - .next (build output)"
echo "    - .git
echo "    - DB de desarrollo
echo "    - download/upload/backups
echo "    - logs
echo "    - screenshots
echo "============================================"
