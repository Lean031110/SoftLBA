# Auditoría de seguridad e infraestructura — P0-1 y P0-2

**Versión:** `1.1.0-rc7`  
**Estado:** cierre de código completado; validación completa bloqueada por el
proxy de red de este entorno (detalles y reproducción abajo).

## Origen de `XTransformPort`

El commit `f25c356` añadió un gateway para el preview sandbox. Caddy aceptaba
`?XTransformPort=<puerto>` y construía el upstream con ese valor; el cliente
Socket.IO y la pantalla de diagnósticos lo usaban para alcanzar los puertos
3003 y 3004. Esa solución mezclaba una necesidad de preview con el Caddy de
producción y permitía al cliente seleccionar el puerto interno.

## Corrección P0-1

- `Caddyfile` ya no lee puertos desde query parameters y toma únicamente los
  puertos de proceso configurados por el entorno del contenedor.
- Socket.IO se publica exclusivamente por la ruta fija `/socket.io/*` hacia
  el proceso realtime configurado.
- Los checks operativos usan rutas fijas `/realtime-health` y
  `/print-worker-health`; no aceptan un upstream del cliente.
- El navegador usa `NEXT_PUBLIC_REALTIME_URL` y
  `NEXT_PUBLIC_REALTIME_PATH` (por defecto, mismo origen y `/socket.io`).
- La compatibilidad de preview se limita a `DEV_ALLOWED_ORIGINS`, sólo cuando
  `SOFTLBA_ENV=development`; nunca debe añadirse al Caddy productivo.

## Configuración por entorno P0-2

La validación server-side está centralizada en `src/lib/environment.ts`; la
configuración no sensible del navegador está aislada en
`src/lib/public-environment.ts`. Los secretos nunca se devuelven desde
`/api/public/config`.

| Variable | Visibilidad | Uso |
|---|---|---|
| `SOFTLBA_ENV` | servidor | `development`, `testing`, `lan` o `production`. |
| `DATABASE_URL` | secreta/interna | Base de datos Prisma. |
| `NEXTAUTH_SECRET` | secreto | Firma de cookies/sesiones; mínimo 16 caracteres. |
| `REALTIME_SECRET` | secreto | Autentica el puente interno de realtime; mínimo 16 caracteres. |
| `APP_INTERNAL_URL` | interna | URL del backend para procesos internos. |
| `REALTIME_INTERNAL_URL` | interna | Ruta interna `/api/internal/emit`. |
| `REALTIME_SERVICE_URL` | interna | Endpoint `/emit` del servicio Socket.IO. |
| `PRINT_WORKER_URL` | interna | Health/API del worker; no se expone al navegador. |
| `WEB_PORT`, `REALTIME_PORT`, `PRINT_WORKER_PORT` | interna | Puertos de cada proceso. |
| `ALLOWED_ORIGINS` | interna | Lista CSV CORS explícita para Socket.IO. |
| `TRUSTED_PROXY_ORIGINS` | interna | Inventario de proxies confiables, para despliegue. |
| `NEXT_PUBLIC_BACKEND_URL` | pública | URL pública del backend. |
| `NEXT_PUBLIC_REALTIME_URL` | pública | URL pública/base de Socket.IO. |
| `NEXT_PUBLIC_REALTIME_PATH` | pública | Ruta Socket.IO, normalmente `/socket.io`. |
| `DEV_ALLOWED_ORIGINS` | desarrollo | CSV de previews/HMR; prohibida para LAN/producción. |

### Perfiles

- **development:** copiar `.env.example`, definir secretos locales únicos y,
  si se usa preview, declarar exclusivamente sus dominios en
  `DEV_ALLOWED_ORIGINS`.
- **testing:** usar secretos efímeros y URLs de los procesos de test; CI los
  define explícitamente.
- **LAN:** configurar URLs públicas con el DNS/IP LAN real y limitar
  `ALLOWED_ORIGINS` a esos orígenes concretos.
- **production:** usar `.env.docker.example` como plantilla, secretos
  aleatorios no versionados, HTTPS/dominio real y una lista cerrada de CORS.

`NEXT_PUBLIC_*` se incorpora en el build de Next.js. Para cambiar una URL
pública en Docker, reconstruir la imagen; no colocar secretos en estas
variables.

## Bloqueo de validación: instalación de dependencias

La instalación no falla por una dependencia, scope privado, lockfile corrupto
ni una configuración del repositorio:

- No existen `bunfig.toml`, `.bunfig.toml` ni `.npmrc` en el repositorio, sus
  directorios padres o el home del usuario de ejecución.
- `npm config get registry` devuelve el registry público oficial
  `https://registry.npmjs.org/`; no hay scopes configurados hacia otro host ni
  credenciales/token de registry.
- `bun.lock` existe y `bun install --frozen-lockfile --dry-run` finaliza con
  código 0. El lock contiene resoluciones de `registry.npmjs.com`, un host
  público normal, y no se modificó.
- El entorno inyecta `HTTP_PROXY`, `HTTPS_PROXY`, `http_proxy`, `https_proxy`,
  `npm_config_http_proxy` y `npm_config_https_proxy` con
  `http://proxy:8080`.
- Una sonda HTTPS a `registry.npmjs.org` y a `registry.npmjs.com` devuelve
  `CONNECT tunnel failed, response 403` desde `envoy`. Forzar
  `--registry=https://registry.npmjs.org/` conserva el mismo 403. Sin proxy,
  el DNS público no resuelve en este sandbox.

Por tanto, la causa es la política de egress/proxy del entorno de ejecución,
no la configuración de SoftLBA. No se deben cambiar versiones, eliminar
`bun.lock` ni retirar `--frozen-lockfile` para ocultar este problema.

### Reproducción

```bash
env | sort | rg -i 'proxy|registry|npm_config|bun|node'
npm config get registry
bun install --frozen-lockfile --dry-run
curl -sSIL --connect-timeout 10 https://registry.npmjs.org/
bun install --frozen-lockfile --registry=https://registry.npmjs.org/
```

### Desbloqueo manual en Ubuntu

1. Si se usa un proxy corporativo, solicitar que permita CONNECT/TLS a
   `registry.npmjs.org` y `registry.npmjs.com`, o configurar el proxy correcto
   en la shell antes de instalar.
2. Si la red dispone de salida directa, retirar las variables de proxy sólo
   para el comando y comprobar DNS/conectividad:

```bash
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
  -u ALL_PROXY -u all_proxy -u npm_config_http_proxy -u npm_config_https_proxy \
  bun install --frozen-lockfile
```

3. Tras una instalación exitosa, ejecutar sin modificar el lockfile:

```bash
bun run typecheck
bun run lint
bun run test:unit
bun run build
```

No se debe iniciar la FASE 2 (Print Worker) hasta que esos cuatro comandos
terminen correctamente.
