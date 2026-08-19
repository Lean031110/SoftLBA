# Configuración — SoftLBA

> Cómo configurar el sistema para desarrollo, pruebas o producción
> **sin tocar código fuente**.

## Filosofía

SoftLBA usa **dos fuentes de configuración**:

1. **`.env`** — secretos + variables de entorno (NO se commitea).
2. **`config.json`** — configuración NO sensible, versionable (copia `config.example.json`).

El módulo central `src/lib/config/index.ts` carga ambas fuentes y expone
una única API tipada y validada. **Ninguna otra parte del código debe leer
`process.env` directamente.**

## Quick start (desarrollo)

```bash
cd SoftLBA
cp .env.example .env
cp config.example.json config.json  # opcional, .env es suficiente
bun install
bun run db:push
bun run db:seed  # datos demo
bun run dev:all
```

## Variables por servicio

### Backend (Next.js)

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto del backend. |
| `BACKEND_URL` | `http://localhost:${PORT}` | URL base para server→server. |
| `NEXT_PUBLIC_BACKEND_URL` | `''` (mismo origen) | URL pública para el browser. |
| `DATABASE_URL` | (obligatorio) | SQLite o PostgreSQL. |

### Realtime (Socket.IO)

| Variable | Default | Descripción |
|---|---|---|
| `REALTIME_PORT` | `3003` | Puerto del mini-servicio. |
| `REALTIME_INTERNAL_URL` | `http://localhost:${REALTIME_PORT}` | URL interna server→server. |
| `REALTIME_EMIT_URL` | `${REALTIME_INTERNAL_URL}/emit` | Endpoint /emit. |
| `NEXT_PUBLIC_REALTIME_URL` | `/?XTransformPort=3003` | URL pública para el browser Socket.IO. |
| `REALTIME_SECRET` | (obligatorio en prod) | Secreto compartido backend↔realtime. |

### Print Worker

| Variable | Default | Descripción |
|---|---|---|
| `PRINT_WORKER_PORT` | `3004` | Puerto del worker. |
| `PRINT_WORKER_URL` | `http://localhost:${PRINT_WORKER_PORT}` | URL interna server→server. |
| `NEXT_PUBLIC_PRINT_WORKER_URL` | `''` (vía gateway) | URL pública para health checks del browser. |
| `PRINT_WORKER_INTERVAL_MS` | `5000` | Intervalo de procesamiento de cola. |

### Auth

| Variable | Default | Descripción |
|---|---|---|
| `NEXTAUTH_SECRET` | (obligatorio en prod, >= 16 chars) | Secreto de sesión. |
| `COOKIE_SECURE` | `true` en prod, `false` en dev | Cookies HTTPS-only. |
| `SESSION_TTL_SECONDS` | `43200` (12h) | Duración de sesión. |

### CORS

| Variable | Default | Descripción |
|---|---|---|
| `ALLOWED_ORIGINS` | `['http://localhost:3000']` en dev | CSV de orígenes permitidos. |

### Logging

| Variable | Default | Descripción |
|---|---|---|
| `LOG_LEVEL_CONSOLE` | `DEBUG` dev / `INFO` prod | Nivel mínimo para consola. |
| `LOG_LEVEL_FILE` | `DEBUG` | Nivel mínimo para archivos. |
| `LOG_DIR` | `./logs` | Directorio de logs. |

## Configuración por entorno

### Desarrollo

`.env`:
```bash
DATABASE_URL=file:./db/custom.db
NEXTAUTH_SECRET=dev-secret-at-least-16-chars
REALTIME_SECRET=dev-internal-secret
COOKIE_SECURE=false
DEMO_USERS=true
ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_REALTIME_URL=/?XTransformPort=3003
```

### LAN (restaurante, sin HTTPS)

`.env`:
```bash
DATABASE_URL=file:./db/custom.db
NEXTAUTH_SECRET=genera-con-openssl-rand-hex-32
REALTIME_SECRET=genera-con-openssl-rand-hex-32
COOKIE_SECURE=false
DEMO_USERS=false
ALLOWED_ORIGINS=http://10.0.0.5:3000,http://10.0.0.5:3003
NEXT_PUBLIC_REALTIME_URL=http://10.0.0.5:3003
NEXT_PUBLIC_PRINT_WORKER_URL=http://10.0.0.5:3004
PORT=3000
REALTIME_PORT=3003
PRINT_WORKER_PORT=3004
```

### Producción con HTTPS

`.env`:
```bash
DATABASE_URL=postgresql://user:pass@db:5432/softlba
NEXTAUTH_SECRET=genera-con-openssl-rand-hex-32
REALTIME_SECRET=genera-con-openssl-rand-hex-32
COOKIE_SECURE=true
DEMO_USERS=false
ALLOWED_ORIGINS=https://pos.midominio.com
NEXT_PUBLIC_REALTIME_URL=wss://pos.midominio.com/socket.io
NEXT_PUBLIC_PRINT_WORKER_URL=https://pos.midominio.com/printworker
PORT=3000
REALTIME_PORT=3003
PRINT_WORKER_PORT=3004
```

## config.json vs .env

| Qué | Dónde | Por qué |
|---|---|---|
| Secretos (NEXTAUTH_SECRET, REALTIME_SECRET) | `.env` | NUNCA en config.json. |
| URLs públicas | `.env` (NEXT_PUBLIC_*) o config.json | Ambos funcionan. |
| Puertos | `.env` o config.json | Ambos funcionan. |
| CORS | `.env` (CSV) o config.json (array) | Ambos funcionan. |
| Logging | `.env` o config.json | Ambos funcionan. |

Prioridad: **`.env` > `config.json` > defaults del código**.

## Cómo usar el módulo config en código

```typescript
// ✅ Correcto
import { getConfig, getSecrets } from '@/lib/config'

const cfg = getConfig()
console.log(cfg.services.realtimePort)
console.log(cfg.cors.allowedOrigins)
console.log(cfg.logging.consoleLevel)

const secrets = getSecrets()
console.log(secrets.nextauthSecret) // NO loggear en producción

// ❌ Incorrecto — no leer process.env directamente
const port = process.env.REALTIME_PORT || '3003'
```

## Validación

```bash
bun run doctor
```

El doctor valida la configuración y reporta errores/warnings.

## Para cambiar de entorno

```bash
# Solo cambia .env y/o config.json, no toques código:
cp .env.production .env
# (o edita .env con tus valores)
bun run dev:all
```

## Variables públicas (browser)

Las variables con prefijo `NEXT_PUBLIC_*` se exponen al browser:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_VERSION`
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_REALTIME_URL`
- `NEXT_PUBLIC_PRINT_WORKER_URL`

Estas se inyectan en el bundle en build time vía `next.config.ts`.
