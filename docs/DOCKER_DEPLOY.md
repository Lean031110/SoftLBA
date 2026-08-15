# SoftLBA — Despliegue con Docker

**Versión:** v1.0.20-rc26+
**Fecha:** 2026-08-15

---

## Requisitos

- Docker 24+ (o Docker Desktop)
- Docker Compose v2+
- 512MB RAM mínimo (1GB recomendado)

---

## Despliegue rápido (LAN)

```bash
# 1. Clonar repositorio
git clone https://github.com/Lean031110/SoftLBA.git
cd SoftLBA

# 2. Configurar variables de entorno
cp .env.docker.example .env
# Editar .env y cambiar NEXTAUTH_SECRET y REALTIME_SECRET:
#   openssl rand -hex 32  # genera un secret aleatorio

# 3. Construir y arrancar
docker compose up -d --build

# 4. Verificar
curl http://localhost:81/api/health
# Debe devolver: {"ok":true,"status":"healthy",...}

# 5. Abrir en navegador
# http://localhost:81
# Login: admin / admin123
```

---

## Servicios

| Servicio | Puerto interno | Puerto externo | Descripción |
|----------|---------------|----------------|-------------|
| `softlba` | 3000 | `${WEB_PORT:-3000}` | Next.js (web app) |
| `softlba` | 3003 | `${REALTIME_PORT:-3003}` | Realtime service (Socket.IO) |
| `caddy` | 80 | `${CADDY_PORT:-81}` | Reverse proxy |

---

## Volúmenes persistentes

| Volumen | Montaje en | Descripción |
|---------|-----------|-------------|
| `softlba-db` | `/app/db` | Base de datos SQLite |
| `softlba-backups` | `/app/backups` | Backups generados |
| `softlba-download` | `/app/download` | Comprobantes, reportes |
| `caddy-data` | `/data` | Datos de Caddy |
| `caddy-config` | `/config` | Configuración de Caddy |

---

## Configuración

### Variables de entorno (`.env`)

Ver `.env.docker.example` para la lista completa. Las críticas:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `NEXTAUTH_SECRET` | (obligatorio) | Secret para firmar tokens de sesión. Mínimo 16 chars. |
| `REALTIME_SECRET` | (obligatorio) | Secret compartido entre Next.js y realtime. |
| `COOKIE_SECURE` | `false` | `true` en HTTPS, `false` en HTTP LAN. |
| `DEMO_USERS` | `true` | `false` en producción para no crear usuarios demo. |
| `INIT_DB` | `true` | Ejecutar `prisma db push` + seed al arrancar. |
| `SKIP_SEED` | `false` | Saltar seed aunque la DB esté vacía. |

### Puertos

Cambiar en `.env`:
```env
WEB_PORT=3000      # Puerto del servidor web
REALTIME_PORT=3003 # Puerto del servicio realtime
CADDY_PORT=81      # Puerto del reverse proxy
```

### HTTPS

Para HTTPS automático con Caddy, cambiar el Caddyfile:
```
midominio.com {
  reverse_proxy softlba:3000
}
```

Y setear `COOKIE_SECURE=true` en `.env`.

---

## Comandos útiles

```bash
# Ver logs
docker compose logs -f softlba
docker compose logs -f caddy

# Reiniciar
docker compose restart softlba

# Parar
docker compose down

# Parar y borrar volúmenes (¡PELIGRO: borra la DB!)
docker compose down -v

# Reconstruir tras actualizar código
docker compose up -d --build

# Entrar al contenedor
docker compose exec softlba sh

# Backup manual de la DB
docker compose exec softlba bun run scripts/backup.ts

# Ejecutar prisma Studio (gestión de DB)
docker compose exec softlba npx prisma studio
```

---

## Arquitectura del Dockerfile

Multi-stage build:

1. **base**: `oven/bun:1.3-debian` — runtime JavaScript
2. **deps**: instala dependencias con `bun install --frozen-lockfile`
3. **builder**: genera build standalone de Next.js + compila realtime service
4. **runner**: imagen final mínima con solo lo necesario para correr

La imagen final NO incluye código fuente, node_modules de dev, ni herramientas de build.

---

## Migración desde systemd (bare-metal)

Si ya tienes SoftLBA corriendo con systemd:

1. Parar servicios: `systemctl stop softlba softlba-realtime`
2. Backup de la DB: `cp /opt/softlba/db/custom.db /tmp/softlba-backup.db`
3. Clonar repo y configurar Docker
4. Copiar DB al volumen:
   ```bash
   docker volume create softlba_softlba-db
   docker run --rm -v softlba_softlba-db:/db -v /tmp:/backup alpine cp /backup/softlba-backup.db /db/custom.db
   ```
5. Setear `INIT_DB=false` en `.env` (la DB ya existe)
6. `docker compose up -d`

---

## Troubleshooting

### El contenedor no arranca
```bash
docker compose logs softlba
```
Revisar si `NEXTAUTH_SECRET` está configurado (mínimo 16 chars).

### La DB no se inicializa
Verificar `INIT_DB=true` en `.env`. Si la DB ya existe, setear `SKIP_SEED=true`.

### El realtime no funciona
Verificar que el puerto 3003 está mapeado y que `REALTIME_SECRET` coincide entre Next.js y el realtime service.

### Caddy no responde
```bash
docker compose logs caddy
```
Verificar que el contenedor `softlba` está healthy (`docker compose ps`).

---

## Backup y restore

### Backup
```bash
# Copiar DB del volumen
docker compose exec softlba bun run scripts/backup.ts

# O copiar directamente el archivo
docker compose cp softlba:/app/db/custom.db ./backup-$(date +%Y%m%d).db
```

### Restore
```bash
# Parar el contenedor
docker compose stop softlba

# Copiar backup al volumen
docker compose cp ./backup-20260815.db softlba:/app/db/custom.db

# Reiniciar
docker compose start softlba
```
