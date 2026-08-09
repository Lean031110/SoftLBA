# Task f5-a — general-purpose agent

## Task
Crear módulos admin: usuarios, productos, noticias, configuración, auditoría, ayuda (CRUD completo, frontend + API).

## Work Log
1. Inspeccioné el proyecto existente: schema Prisma, helpers de auth/audit/permissions, PanelLayout, dashboard API, página de login y middleware existente.
2. Creé el módulo de Usuarios:
   - `/api/admin/usuarios` (GET con filtros q/role/isActive + POST crear con username auto + contraseña aleatoria + hashPassword + mustChangePass=true + audit)
   - `/api/admin/usuarios/[id]` (GET + PATCH editar + DELETE desactivar, no borrar; se bloquea auto-desactivación)
   - `/api/admin/usuarios/[id]/reset-password` (POST con contraseña opcional o aleatoria)
   - Página lista con tabla, búsqueda, filtros, dialog de contraseña reseteada con copiar al portapapeles
   - Página nuevo con autogeneración de username/contraseña y dialog de credenciales tras crear
   - Página editar con switch de activo, botón de resetear contraseña
3. Creé el módulo de Productos:
   - API list/create y [id] GET/PATCH/DELETE con validación de code único y toggles isActive/isAvailable
   - Página lista con tabla y toggles por columna, badges de tipo con colores
   - Páginas nuevo/editar con todos los campos (cost, price, minStock, etc.)
4. Creé el módulo de Noticias:
   - API list/create y [id] GET/PATCH/DELETE
   - Página lista con tabla, filtros, alert-dialog de confirmación al eliminar
   - Páginas nuevo/editar con tipo (INFO/WARNING/PROMO/URGENT), prioridad, expiración, switches pública/activa
5. Creé el módulo de Configuración (singleton id='config-1'):
   - API GET (crea si no existe) y PATCH con todos los campos
   - Página con tabs: General / Contacto / Redes / Recibo
6. Creé el módulo de Auditoría:
   - API GET con paginación, filtros (q/action/entity/userId/from/to)
   - Página con tabla, filtros, paginación simple y dialog de detalle con JSON before/after
7. Creé el módulo de Ayuda:
   - API admin list/create y [id] GET/PATCH/DELETE
   - API pública `/api/help` para usuarios autenticados (cualquier rol)
   - Página admin lista con tabla y agrupar por módulo
   - Páginas admin nuevo/editar
   - Página pública `/ayuda` con búsqueda y accordion agrupado por módulo, link a admin si es ADMIN
8. Fix crítico: el middleware usaba `createHmac` de Node 'crypto' que no funciona en Edge Runtime, devolviendo siempre SESION_EXPIRADA y bloqueando TODAS las rutas `/api/admin/*`. Reescribí `src/lib/auth/token.ts` para usar Web Crypto API (`crypto.subtle`) compatible con Edge y Node, hice async `verifySessionToken` y actualicé los callers (`getCurrentUser` y `middleware.ts`).
9. Lint: 0 errores.
10. Verifiqué con curl todos los endpoints: login → cookies → GET listar, POST crear, GET uno, PATCH editar, POST reset-password, DELETE desactivar, filtros y paginación de audit. Todos respondieron 200 con `{"ok":true,...}`.

## Stage Summary
- **Archivos API creados**: 11 archivos route.ts (usuarios route + [id] + [id]/reset-password, productos route + [id], news route + [id], config route, audit route, help route + [id], api/help route)
- **Archivos de página creados**: 13 page.tsx (usuarios list/nuevo/[id], productos list/nuevo/[id], noticias list/nuevo/[id], configuracion, auditoria, ayuda list/nuevo/[id], pública /ayuda)
- **Archivos modificados**: `src/lib/auth/token.ts` (Web Crypto), `src/lib/auth/index.ts` (async verifySessionToken), `src/middleware.ts` (await verifySessionToken)
- **Decisiones importantes**: 
  - Usé `generateRandomPassword()` y `hashPassword()` del helper de auth para los usuarios nuevos (no exponer contraseña en el select del listado).
  - Toggles de producto usan PATCH parcial en lugar de endpoints dedicados (simplifica la API).
  - Vista pública `/ayuda` accesible para cualquier usuario autenticado sin restricción de rol (el middleware no bloquea `/ayuda` ni `/api/help`).
  - Configuración como singleton con id fijo `config-1` creado on-demand.
  - Auditoría con paginación server-side (mín 10, máx 100 por página).
- **Problemas encontrados**:
  - ESLint bloqueaba el uso de la variable `module` en `help/route.ts` (regla `@next/next/no-assign-module-variable`). Renombré a `moduleQ`.
  - El middleware existente usaba `createHmac` (Node 'crypto') que fallaba en Edge Runtime y devolvía SESION_EXPIRADA en cada petición `/api/admin/*`. Lo arreglé usando Web Crypto API (async) — fix beneficioso para toda la aplicación, no solo los nuevos módulos.
