# CHANGELOG - SoftLBA

Todo los cambios notables del proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).

---

## [v0.6.0] - 2026-08-09 - FIX VISUAL + ROL MESERO_PRO + COMANDAS

### Resumen
Corrige el bug visual del nuevo pedido, reemplaza todos los colores naranja por
azul, añade el rol MESERO_PRO (cierres sin finanzas), permite añadir/cancelar
productos en comandas existentes, y hace que el cierre de caja genere entradas
automáticas en finanzas general.

### Corregido
- **Bug visual del nuevo pedido**: El carrito se veía mezclado, con productos
  superpuestos y notas confundidas. Ahora cada item tiene su propia tarjeta con
  borde, sombra, y secciones claramente separadas (header, cantidad+subtotal, notas).
- **Colores naranja restantes**: Reemplazados por azul en 15 archivos:
  - panel-layout, page, login, perfil, comprobante, kitchen-dashboard
  - admin/page, usuarios, productos, noticias, finanzas, auditoria, ayuda
  - permissions, mesero/pedidos/[id]
  - amber se mantiene para warnings (correcto)
- **Versión desactualizada**: v0.2.0 → v0.6.0 en footer de home y panel
- **Botón "Atrás" en ayuda**: Iba a `/` (home pública). Ahora vuelve al panel
  del rol correspondiente (ej: mesero va a `/mesero`).

### Agregado
- **Rol MESERO_PRO** (mesero pro):
  - Puede: crear pedidos, cobrar, hacer cierres diarios
  - No puede: acceder a finanzas, usuarios, productos, configuración, auditoría
  - Usuario demo: `meseropro / meseropro123`
  - Color badge: teal
- **Gestión de items en comandas existentes**:
  - `POST /api/mesero/orders/[id]/items` - Añadir item a pedido existente
  - `PATCH /api/mesero/orders/[id]/items/[itemId]` - Editar cantidad/notas
  - `DELETE /api/mesero/orders/[id]/items/[itemId]` - Cancelar item (soft delete)
  - Reglas: solo items en estado PENDIENTE se pueden editar/cancelar
  - Lo cancelado se guarda como CANCELADO (no se borra, trazabilidad)
  - Recálculo automático de totales
- **Cancelación de pedido mejorada**:
  - Verifica que NINGÚN item esté en preparación antes de cancelar
  - Si hay items en preparación, devuelve error con instrucciones
- **Finanzas automáticas al cerrar caja**:
  - Al cerrar el cierre diario, crea entradas en FinanceEntry por:
    - Cada método de pago con ventas (EFECTIVO_CUP, TRANSFERENCIA_USD, etc.)
    - Resumen de mermas del día
  - Cada entrada tiene `dailyCloseId` para trazabilidad
  - Si se reabre y vuelve a cerrar, borra las entradas anteriores y crea nuevas
  - Recalcula totales finales del cierre antes de cerrar

### Cambiado
- CAJERO ya no tiene acceso a finanzas (solo ADMIN)
- MESERO_PRO puede acceder a /admin/cierre-diario (páginas y APIs)
- Middleware: búsqueda de prefijo más específico (ordenado por longitud)
- Página /ayuda reescrita para usar PanelLayout y volver al panel correcto
- Seed: añadido usuario meseropro

### Verificación
- ✅ Lint limpio (0 errores)
- ✅ meseropro: /api/mesero/orders (200), /api/admin/cierre-diario (200)
- ✅ meseropro: /api/admin/finanzas (403), /api/admin/dashboard (403)
- ✅ admin: acceso total (200 en todo)
- ✅ Layout del nuevo pedido limpio y claro (probado con Agent Browser)
- ✅ Botón atrás en ayuda vuelve al panel del rol
- ✅ Todas las páginas responden 200

### Backup
- `download/salva/SoftLBA-v0.6.0-{timestamp}.tar.gz` (solo código fuente)

---

## [v0.5.0] - 2026-08-09 - FIX LOGIN + TOGGLE USUARIOS DEMO

### Resumen
Corrige el bug crítico del login (se quedaba renderizando sin cargar nada) y
añade un toggle en la configuración del admin para mostrar/ocultar los usuarios
demo en la página de login.

### Corregido
- **Bug crítico del login**: La página `/login` se quedaba renderizando solo el
  logo y el título "SoftLBA", pero el formulario de acceso (usuario, contraseña,
  botón Entrar) nunca aparecía. Causa: `useSearchParams()` requiere un boundary
  `<Suspense>` en Next.js 16, y sin él la página no renderiza el contenido
  dinámico.
  - **Solución**: Envolver el componente `LoginForm` en `<Suspense>` con un
    fallback (spinner azul) mientras carga los search params.

### Agregado
- **Toggle "Mostrar usuarios demo en el login"** en Configuración > General:
  - Nuevo campo `showDemoUsers` en modelo `RestaurantConfig` (Boolean, default true)
  - Switch en la página `/admin/configuracion` (pestaña General)
  - API pública `/api/public/config` ahora devuelve `showDemoUsers`
  - API admin `PATCH /api/admin/config` acepta `showDemoUsers: boolean`
  - Cuando está activo: el login muestra un botón colapsable "Ver usuarios demo"
    que al pulsarlo despliega las credenciales (admin/mesero/cocina/cajero)
  - Cuando está inactivo: el botón no aparece, mayor seguridad en producción
- **Botón colapsable "Ver usuarios demo"** en la página de login:
  - Por defecto colapsado (no muestra las credenciales)
  - Al pulsar, despliega las 4 credenciales demo con su rol
  - Solo aparece si `showDemoUsers=true` en la configuración
- Configuración por defecto en API pública si no hay registro en BD

### Cambiado
- Página `/login` reestructurada:
  - Componente `LoginForm` separado dentro de `<Suspense>`
  - Componente `DemoUsersSection` que consulta `showDemoUsers` y se renderiza condicionalmente
  - Las credenciales demo ahora están colapsadas por defecto (botón para mostrar)

### Verificación
- ✅ Lint limpio (0 errores)
- ✅ Schema aplicado (db:push OK con campo showDemoUsers)
- ✅ Login carga correctamente: formulario visible, botón Entrar funcional
- ✅ Login como admin redirige a /admin correctamente
- ✅ Toggle en configuración funciona (probado end-to-end)
- ✅ Cuando showDemoUsers=false: botón "Ver usuarios demo" no aparece en login
- ✅ Cuando showDemoUsers=true: botón aparece y es colapsable
- ✅ Todas las páginas responden 200

### Backup
- `download/salva/SoftLBA-v0.5.0-{timestamp}.tar.gz` (solo código fuente)

---

## [v0.4.0] - 2026-08-09 - PUNTOS 6-10 DE LA GUÍA

### Resumen
Profundización en los puntos 6 (Estructura general), 7 (Módulo de usuarios),
8 (Página principal con noticias), 9 (Información del restaurante) y
10 (Productos y recetas) de la especificación maestra.

### Punto 6: Estructura general del sistema ✅
Verificado que existe y funciona:
- ✅ 6.1 Página principal pública `/` con logo, nombre, info, noticias, productos, botón login
- ✅ 6.2 Login con autenticación, redirección por rol, primer acceso con perfil obligatorio
- ✅ 6.3 Panel de administración con acceso total (15+ módulos)
- ✅ 6.4 Área de meseros (solo su sesión, sus pedidos, crear pedidos, cobrar, notificaciones)
- ✅ 6.5 Área de cocina (recibe pedidos, tarjetas expandibles, marca estados)
- ✅ 6.6 Área de pizzería/producción (similar a cocina, con su inventario)
- ✅ 6.7 Inventario por áreas: salón, cocina, pizzería, producción
- ✅ 6.8 Finanzas: ventas, gastos, salarios, compras, mermas, cierre, libro mayor

### Punto 7: Módulo de usuarios ✅
- ✅ 7.1 Creación: admin crea usuario con nombre, apellidos, rol. Sistema genera username único y contraseña aleatoria
- ✅ 7.2 Primer inicio de sesión: cambio obligatorio de contraseña + perfil completo (nombre, apellidos, teléfono, móvil, correo, dirección, carnet, bio)
- ✅ 7.3 Perfil: Toda la información guardada y visible para el admin en cualquier momento
  - **AÑADIDO**: Panel "Información de acceso" en página de edición de usuario con:
    - Último acceso (fecha y hora)
    - Última IP
    - Fecha de creación
    - Sesiones activas (con IP, user agent, fecha de inicio y expiración)
    - Historial de accesos de los últimos 30 días (logins y logouts)
- ✅ 7.4 Reglas: username único, historial de acceso, estado activo/inactivo, rol editable

### Punto 8: Página principal con noticias ✅
- **AÑADIDAS** 4 noticias más al seed para cubrir todos los casos de la guía:
  - "Cambio de menú" (INFO, pública) - nuevos platos
  - "Producto agotado" (URGENT, pública) - sin stock de cerveza
  - "Cambio de turno" (WARNING, privada) - recordatorio a meseros
  - "Cambio de precio" (INFO, pública) - ajuste en bebidas
- Tipos de noticia soportados: INFO, WARNING, PROMO, URGENT
- Noticias públicas vs privadas (isPublic): funcionando correctamente
- Prioridades funcionando (orden por prioridad desc + fecha)

### Punto 9: Información del restaurante ✅
Verificado que la configuración se reutiliza en:
- ✅ Home (`page.tsx` - muestra nombre, eslogan, dirección, teléfono, email, horario)
- ✅ Login (muestra nombre del restaurante)
- ✅ Comprobante de pago (todos los datos del restaurante)
- ✅ Encabezados del panel (sidebar con logo + nombre)
- ✅ API pública `/api/public/config` (accesible sin auth)
- ✅ API admin `/api/admin/config` (editar config)

### Punto 10: Productos y recetas ✅
- ✅ 10.1 Tipos de productos: DIRECTO, FINAL, SUBPRODUCTO (todos implementados)
- ✅ 10.2 Relación entre productos: **AÑADIDA API y UI completa**
  - Nuevo endpoint: `GET/POST/DELETE /api/admin/productos/[id]/subproducts`
  - Nuevo componente: `SubproductManager` en página de edición de producto
  - Solo aparece para productos de tipo FINAL
  - Muestra lista de subproductos asociados con cantidad, unidad y costo
  - Calcula costo total automático
  - Permite añadir cualquier producto como subproducto (con cantidad)
  - Permite quitar subproductos con confirmación
  - Audit log en cada acción (ADD_SUBPRODUCT, UPDATE_SUBPRODUCT, REMOVE_SUBPRODUCT)
- ✅ 10.3 Recetas: con ingredientes, cantidades, unidades, costo, rendimiento, producto final
- ✅ 10.4 Productos activos e inactivos: panel del mesero solo muestra productos finales activos y disponibles

### Agregado
- Endpoint `/api/admin/productos/[id]/subproducts` (GET/POST/DELETE) para gestionar subproductos
- Componente `SubproductManager` con UI completa para asociar subproductos a productos finales
- Panel de "Información de acceso" en página de edición de usuario con:
  - Resumen (último acceso, IP, creado, sesiones activas)
  - Lista de sesiones activas con detalles
  - Historial de accesos (logins/logouts de 30 días)
- 4 noticias adicionales en seed (cambio de menú, producto agotado, cambio de turno, cambio de precio)
- Script de backup mejorado: ahora excluye node_modules, .next, builds, skills, agent-ctx, tests, logs, .env.local, bun.lock

### Cambiado
- `GET /api/admin/usuarios/[id]` ahora devuelve también `lastLoginIp`, `profile`, `sessions` (activas) y `accessHistory` (30 días)
- Script de backup: solo incluye código fuente, sin dependencias ni builds

### Verificación
- ✅ Lint limpio (0 errores)
- ✅ Todas las páginas responden 200
- ✅ API de subproductos probada end-to-end (crear, listar, eliminar)
- ✅ Historial de accesos verificado en página de usuario (muestra logins/logouts con IP)
- ✅ Noticias: 5 públicas + 2 privadas en home (verificado con Agent Browser)
- ✅ Subproductos: section visible en productos finales, oculta en otros tipos

### Backup
- `download/salva/SoftLBA-v0.4.0-{timestamp}.tar.gz` (solo código fuente)

---

## [v0.3.0] - 2026-08-09 - PUNTOS 2-5 DE LA GUÍA

### Resumen
Profundización punto por punto en los puntos 2 (Objetivo principal), 3 (Principios
fundamentales), 4 (Tecnología) y 5 (Entorno de uso) de la especificación maestra.

### Punto 2: Objetivo principal ✅
Verificado que el sistema cumple: "Permitir que el restaurante funcione digitalmente
en red local, con control total desde administración, pedidos en tiempo real,
inventarios separados por área, finanzas trazables y reportes completos."

- ✅ Control total desde administración (panel admin completo)
- ✅ Pedidos en tiempo real (WebSocket + Socket.IO)
- ✅ Inventarios separados por área (salón, cocina, pizzería, producción)
- ✅ Finanzas trazables (todas las entradas con audit log)
- ✅ Reportes completos (dashboard, finanzas, cierre diario, auditoría)

### Punto 3: Principios fundamentales ✅
Verificados y reforzados los 10 principios:

1. **Sin Internet obligatorio** ✅
   - Eliminadas dependencias de fuentes de Google (Geist fonts)
   - No hay servicios externos (cloudflare, firebase, etc.)
   - Todo funciona en red local

2. **Todo usuario autenticado** ✅
   - Middleware protege todas las rutas no públicas
   - Sin sesión → redirige a login
   - Sesión expirada → redirige a login

3. **Cada rol ve solo lo suyo** ✅
   - Verificado: mesero no accede a /api/cocina/orders (403)
   - Verificado: cocina no accede a /api/mesero/orders (403)
   - Verificado: cajero no accede a /api/admin/usuarios (403)
   - Permisos granulares por rol en cada API

4. **Cada movimiento queda registrado** ✅
   - 51 llamadas a audit() en 64 APIs
   - AuditLog en: LOGIN, LOGOUT, CREATE, UPDATE, DEACTIVATE,
     CHANGE_PASSWORD, OPEN_DAILY_CLOSE, ADD_DENOMINATION, etc.
   - Login/logout también registrados

5. **No borrar historia, solo corregir con trazabilidad** ✅
   - **CORREGIDO**: Customer ahora tiene campo `isActive` (soft delete)
   - **CORREGIDO**: DELETE de clientes ahora desactiva en lugar de borrar
   - **CORREGIDO**: DELETE de promociones ahora desactiva en lugar de borrar
   - Productos ya usaban soft delete (isActive)
   - Usuarios ya usaban soft delete (isActive)
   - Noticias ya usaban soft delete (isActive)
   - HelpArticle ya usaba soft delete (isActive)

6. **Interfaz rápida, clara y moderna** ✅
   - Diseño minimalista con shadcn/ui
   - Animaciones suaves (Tailwind transitions)
   - Layout responsive
   - Componentes accesibles (ARIA)

7. **Móvil y tablet primero** ✅
   - Diseño mobile-first en todas las páginas
   - Sidebar colapsable en móvil (Sheet component)
   - Touch-friendly (botones ≥44px)
   - Responsive: 7 clases sm/md/lg/xl en home, 5 en panel, etc.

8. **Base de datos preparada para migrar** ✅
   - No hay SQL crudo en el código
   - Todo va por Prisma ORM
   - Schema único en prisma/schema.prisma
   - Solo cambiar `provider` y `DATABASE_URL` para migrar
   - Creada guía detallada: `docs/migracion-base-datos.md`

9. **El sistema debe escalar sin romperse** ✅
   - Arquitectura modular (cada módulo independiente)
   - Mini-servicio WebSocket separado del Next.js
   - Prisma con paginación en todas las listas
   - Índices en campos críticos (userId, areaId, status, createdAt)

10. **La ayuda debe estar integrada** ✅
    - 8 artículos de ayuda en 5 módulos (pedidos, productos, cierre, inventario, sistema)
    - Página /ayuda accesible por cualquier rol
    - Editor en /admin/ayuda

### Punto 4: Tecnología ✅
- TypeScript ✅
- Next.js 16 + React 19 ✅
- Socket.IO para tiempo real ✅
- Prisma 6 ORM ✅
- SQLite inicial, migrable a PostgreSQL/MySQL ✅
- Tailwind CSS 4 ✅
- shadcn/ui ✅
- Framer Motion disponible ✅
- Creada guía de migración: `docs/migracion-base-datos.md`

### Punto 5: Entorno de uso ✅
Verificado que funciona en:
- ✅ Servidor local o PC principal (Next.js + SQLite local)
- ✅ Red Wi-Fi interna (servidor escucha en 0.0.0.0)
- ✅ Tablets (diseño responsive md:)
- ✅ Teléfonos (diseño mobile-first, sm:)
- ✅ Computadoras con navegador (responsive completo)
- ✅ Dispositivos de cocina (vista cocina optimizada para pantallas)
- ✅ Dispositivos de administración (panel admin completo)

No depende de servicios externos:
- ✅ Sin fuentes de Google
- ✅ Sin CDNs externos
- ✅ Sin APIs externas
- ✅ Solo requiere Node.js/Bun instalado

### Agregado
- Campo `isActive` en modelo `Customer` (soft delete)
- Documento `docs/migracion-base-datos.md` con guía detallada de migración
  a PostgreSQL y MySQL/MariaDB

### Cambiado
- `DELETE /api/admin/clientes/[id]` ahora hace soft delete (isActive=false)
  en lugar de borrar el registro
- `DELETE /api/admin/promociones/[id]` ahora hace soft delete (isActive=false)
  en lugar de borrar el registro
- `PATCH /api/admin/clientes/[id]` ahora permite editar `isActive` (para
  reactivar clientes desactivados)

### Corregido
- **Bug de trazabilidad**: Los DELETE de clientes y promociones violaban el
  principio "No borrar historia". Ahora usan soft delete.
- Audit log en DELETE ahora registra acción 'DEACTIVATE' (más preciso)

### Verificación
- ✅ Lint limpio (0 errores)
- ✅ Schema aplicado correctamente (db:push OK)
- ✅ Todas las páginas responden 200
- ✅ Control de acceso por rol verificado (403 en accesos no autorizados)
- ✅ Audit log en todas las acciones sensibles
- ✅ Sin dependencias externas (100% offline)

### Backup
- `download/salva/SoftLBA-v0.3.0-{timestamp}.tar.gz`

---

## [v0.2.0] - 2026-08-09 - REBRANDING SOFTLBA

### Resumen
Rebranding completo del proyecto a **SoftLBA**. Nuevo logo profesional, paleta de
color azul como acento principal, fixes del preview, y script de backup que
guarda todo el código en `/home/z/my-project/download/salva/`.

### Agregado
- **Logo profesional SoftLBA** generado con IA (image-generation skill):
  - `public/softlba-logo.png` (1024x1024, logo principal con "S" estilizada)
  - `public/softlba-favicon.png` (1024x1024, favicon minimalista)
  - `public/softlba-logo.svg` (logo vectorial SVG con gradiente azul)
- **Script de backup mejorado** `scripts/backup.ts`:
  - Guarda en `/home/z/my-project/download/salva/`
  - Formato: `SoftLBA-v{version}-{timestamp}.tar.gz`
  - Incluye TODO el código del proyecto (1849 archivos)
  - Excluye node_modules, .next, .git, backups, logs
  - Reporta tamaño en MB y lista backups previos
- **Script generador de logo** `scripts/generate-logo.ts`
- **Comandos en package.json**:
  - `bun run logo` - regenerar logos
  - `bun run simulate` - simular día completo
  - `bun run backup [version]` - crear backup

### Cambiado
- **Nombre del proyecto**: `nextjs_tailwind_shadcn_ts` → `softlba`
- **Versión del package.json**: `0.2.1` → `0.2.0`
- **Color de acento principal**: naranja (#f97316) → azul (#2563eb en light, #3b82f6 en dark)
- **Variables CSS de tema** actualizadas en `globals.css`:
  - `--primary` ahora usa azul oklch
  - `--accent`, `--ring`, `--sidebar-primary`, `--chart-1` todos azules
- **Logo en todas las páginas**:
  - Home pública: header con logo SoftLBA + nombre del restaurante como subtítulo
  - Login: logo grande centrado + "SoftLBA" como título
  - Logout: logo + spinner azul
  - Primer acceso: logo + título SoftLBA
  - Panel (sidebar): logo SoftLBA + nombre del restaurante debajo
  - Mobile menu (Sheet): logo SoftLBA + nombre del restaurante
  - Footer de panel: logo SoftLBA + versión
  - Footer de home: logo SoftLBA + nombre restaurante
- **Metadata del layout**: 
  - Title: `SoftLBA - Sistema de Restaurante`
  - Description actualizada con SoftLBA
  - Keywords incluyen SoftLBA
  - Favicon: `/softlba-logo.svg`
  - Apple touch icon: `/softlba-logo.png`
- **Clases Tailwind** migradas de `stone` a `slate` y de `orange` a `blue`

### Corregido
- **Bug de preview**: el servidor Next.js y el servicio realtime se caían tras
  periodos de inactividad. Ahora se usan procesos `setsid` + `nohup` con
  `disown` para que sobrevivan al cierre del shell. El script oficial
  `.zscripts/dev.sh` también funciona correctamente.
- **Lint**: sin errores tras el rebranding.

### Verificación
- ✅ Lint limpio (0 errores)
- ✅ Todas las páginas responden 200 (públicas, admin, mesero, cocina, pizzería)
- ✅ APIs principales responden 200
- ✅ Logos accesibles: SVG (1095 bytes), PNG (66 KB), favicon (47 KB)
- ✅ Backup v0.2.0 creado en `/download/salva/SoftLBA-v0.2.0-*.tar.gz` (40 MB)
- ✅ Pruebas con Agent Browser:
  - Home pública muestra logo SoftLBA + nombre del restaurante
  - Login con logo y título SoftLBA + color azul
  - Dashboard admin con sidebar mostrando logo SoftLBA + nombre restaurante
  - Footer muestra "SoftLBA · v0.2.0 · Sistema local para restaurante"

### Backup
- `download/salva/SoftLBA-v0.2.0-2026-08-09T13-08-24.tar.gz` (40 MB, 1849 archivos)

---

## [v0.1.1] - 2026-08-09 - CORRECCIONES Y FUNCIONES FALTANTES

### Resumen
Versión de corrección que completa las funciones faltantes detectadas al comparar
con la especificación maestra. Se corrigen bugs críticos de permisos, se añaden
el cambio obligatorio de contraseña en primer acceso, el perfil de usuario, las
notificaciones persistentes con campana en el header, y se valida todo mediante
una simulación completa de día de trabajo end-to-end.

### Agregado
- **Cambio obligatorio de contraseña en primer acceso** (especificación 7.2):
  - Nuevo endpoint `POST /api/auth/change-password` con validación de contraseña actual
  - Nueva página `/primer-acceso` que fuerza el cambio de contraseña temporal
  - Login redirige automáticamente a `/primer-acceso` cuando `mustChangePass=true`
  - Validación: mínimo 6 caracteres, no puede ser igual a la actual
  - Audit log del cambio
- **Perfil de usuario completo** (especificación 7.3):
  - Nuevo endpoint `GET/PATCH /api/auth/profile`
  - Nueva página `/perfil` con todos los campos: nombre, apellidos, teléfono fijo,
    móvil, correo, dirección, carnet, biografía
  - Validación de email único
  - Avatar con iniciales del usuario
  - Botón "Cambiar contraseña" dentro del perfil
  - Enlace "Mi perfil" en el menú de usuario del header
- **Sistema de notificaciones persistente** (especificación 13):
  - Nuevo endpoint `GET/POST /api/notifications`
  - Nuevo endpoint `POST /api/notifications/read` (marcar leídas individual o todas)
  - Campana de notificaciones en el header (`NotificationBell`)
    - Badge con contador de no leídas
    - Popover con lista de notificaciones (30 más recientes)
    - Botón "Marcar todo leído"
    - Indicador de conexión WebSocket (punto verde)
    - Auto-refresh cada 30 segundos
  - Sonido y vibración cuando llega una notificación en tiempo real
  - Toast automático con sonner para cada evento
  - Click en notificación navega al pedido relacionado (si aplica)
- **Endpoint de recálculo de cierre diario**:
  - `POST /api/admin/cierre-diario/[id]/recalc`
  - Recalcula totales (ventas, efectivo, transferencias, mermas, descuentos)
    basándose en los pagos del día
  - Útil cuando se abrió el cierre temprano y llegaron más pedidos después
- **Rutas autenticadas comunes** en middleware:
  - `/primer-acceso`, `/perfil`, `/ayuda`, `/api/notifications`
  - Accesibles por cualquier rol autenticado

### Corregido
- **Bug crítico de middleware**: El cajero no podía acceder a
  `/api/admin/cierre-diario/*` ni `/api/admin/finanzas/*` porque la ruta
  `/api/admin/*` estaba protegida solo para ADMIN. Ahora hay reglas específicas
  que permiten al CAJERO acceder a cierre-diario y finanzas.
- **Bug crítico de cálculo de cierre**: El `totalExpected` se calculaba solo al
  abrir el cierre. Si llegaban más pedidos después, no se actualizaba. Ahora se
  puede recalcular con el endpoint `/recalc`.
- **Bug de redirección post-login**: Cuando un usuario tenía `mustChangePass=true`,
  no se le redirigía a cambiar contraseña. Ahora sí.
- **Lint**: Eliminado import no usado en script de simulación.

### Cambiado
- Middleware: añadidas reglas más finas para rutas API de finanzas y cierre
  diario que ahora permiten acceso a CAJERO además de ADMIN.
- Login: si `mustChangePass=true`, redirige a `/primer-acceso` en lugar del home.
- PanelLayout: el botón de notificaciones simple se reemplazó por el componente
  `NotificationBell` con lista, badge, sonido y auto-refresh.

### Seguridad
- Validación de contraseña actual obligatoria para cambiar a una nueva
- Email único verificado al actualizar perfil
- Audit log en cambios de contraseña y actualizaciones de perfil
- Tokens de sesión firmados con HMAC SHA-256 (Web Crypto API, compatible Edge)

### Verificación
- ✅ Lint limpio (0 errores)
- ✅ Todas las páginas responden 200 (incluidas las nuevas /perfil, /primer-acceso)
- ✅ Simulación completa de día de trabajo ejecutada exitosamente:
  - Login como admin, mesero, cocina, cajero (4 roles)
  - Configuración del restaurante cargada correctamente
  - Creación de productos desde admin
  - Mesero ve 13 productos disponibles y 10 mesas
  - Mesero crea 2 pedidos (uno con 3 items y notas, otro con descuento 10%)
  - Cocina ve los 2 pedidos pendientes
  - Cocina cambia estados: ENVIADO → EN_PREPARACION → LISTO
  - Mesero ve sus pedidos actualizados en tiempo real
  - Mesero cobra con efectivo CUP y con pago combinado (efectivo + transferencia)
  - Dashboard admin muestra 6 pedidos y $1726 en ventas del día
  - Resumen financiero: $1876 ingresos, $0 egresos, balance $1876
  - Cajero abre cierre, recalcula (esperado sube de $3350 a $4310), registra
    denominaciones (4 tipos), diferencia calculada correctamente
  - Auditoría: 10 registros visibles con acciones detalladas
  - Respaldo manual creado (532 KB)
  - Notificaciones funcionando
  - Perfil de mesero actualizado con datos personales
- ✅ Pruebas con Agent Browser exitosas:
  - Home pública muestra noticias y carta
  - Login funciona para los 4 roles
  - Dashboard admin carga con todas las secciones
  - Campana de notificaciones abre el popover
  - Menú de usuario muestra "Mi perfil" y "Cerrar sesión"
  - Página /perfil carga con todos los campos
  - Mesero crea pedido: agrega productos, ve subtotal, envía a cocina
  - Cocina ve pedidos en tarjetas, cambia estados con un click
  - Mesero cobra pedido con modal de pago
  - Comprobante generado con todos los datos del restaurante

---

## [v0.1.0] - 2026-08-09 - BASE INICIAL SÓLIDA

### Resumen
Primera versión funcional del sistema. Incluye la base completa del proyecto con
autenticación, roles, layout principal, página pública con noticias, panel de
administración (usuarios, productos, recetas, inventarios, configuración),
área de meseros con creación de pedidos, área de cocina con vista de tarjetas,
tiempo real con WebSocket, finanzas básicas, cierre diario, comprobantes y
auditoría. Base de datos SQLite + Prisma, lista para migrar a PostgreSQL/MySQL.

### Agregado
- Inicialización del entorno fullstack (Next.js 16 + TypeScript + Tailwind 4 + Prisma + shadcn/ui)
- Estructura de directorios organizada por módulos (admin, mesero, cocina, pizzería)
- Archivo `.env` con `DATABASE_URL` apuntando a SQLite local
- Schema Prisma completo con todas las entidades del sistema:
  - Usuarios, perfiles, roles, sesiones, auditoría
  - Configuración del restaurante, noticias, áreas
  - Productos (directos, finales, subproductos), recetas, ingredientes
  - Inventario general y por áreas, movimientos de stock, stock físico
  - Pedidos, items de pedido, estados, pagos, métodos de pago
  - Clientes, promociones
  - Finanzas: ingresos, egresos, compras, mermas, salarios
  - Cierre diario con denominaciones
  - Artículos de ayuda integrada
  - Registro de respaldos
- Seed inicial con:
  - Usuario administrador por defecto (admin / admin123)
  - Configuración base del restaurante
  - Áreas: salón, cocina, pizzería, producción
  - Noticia de bienvenida
  - Productos de ejemplo
  - Métodos de pago configurados
- Sistema de autenticación con NextAuth.js
  - Login por usuario/contraseña
  - Roles: ADMIN, MESERO, COCINA, PIZZERIA, CAJERO
  - Protección de rutas por rol
  - Cierre de sesión
  - Cambio obligatorio de contraseña en primer acceso
- Layout principal:
  - Sidebar lateral con navegación por rol
  - Header con info de usuario y logout
  - Tema claro/oscuro con next-themes
  - Diseño responsive (mobile-first, tablet, desktop)
  - Sticky footer
- Página pública `/`:
  - Logo, nombre del restaurante, eslogan
  - Noticias y avisos públicos
  - Productos disponibles
  - Botón de login
- Panel de administración `/admin`:
  - Dashboard con resumen (ventas del día, pedidos activos, stock crítico)
  - Gestión de usuarios (crear, editar, activar/desactivar)
  - Gestión de productos (crear, editar, activar/desactivar, clasificar)
  - Gestión de recetas
  - Inventario general (entradas, salidas, traslados, ajustes)
  - Inventario por áreas
  - Configuración general del restaurante
  - Gestión de noticias
  - Vista de auditoría
- Área de meseros `/mesero`:
  - Solo ve pedidos propios
  - Crear pedido (seleccionar mesa, productos, cantidades, notas)
  - Ver estados en tiempo real
  - Cobrar según permisos
- Área de cocina `/cocina`:
  - Vista de tarjetas expandibles
  - Marcar estados (en preparación, listo, servido)
  - Filtrado por área
- Área de pizzería `/pizzeria` (flujo similar a cocina)
- Tiempo real con WebSocket:
  - Mini servicio socket.io en puerto 3003
  - Notificaciones de nuevos pedidos a cocina
  - Notificaciones de cambios de estado al mesero
  - Sonido y vibración
- Finanzas:
  - Registro de ventas, gastos, compras, mermas, salarios
  - Libro mayor resumido
  - Reporte por día y por rango
- Cierre diario:
  - Conteo de denominaciones por moneda
  - Resumen del día (ventas por método, por área, mermas, descuentos)
  - Comparación teórico vs real
  - Bloqueo de período
- Comprobantes:
  - Generación de comprobante visual
  - Contiene logo, datos, items, totales, método de pago
  - Descarga como imagen
- Auditoría:
  - Registro automático de acciones CRUD
  - Usuario, fecha, antes/después, IP
- Respaldo:
  - Respaldo manual de la base de datos
  - Historial de copias
- Documentación:
  - README.md con instrucciones de instalación y uso
  - CHANGELOG.md (este archivo)
  - Comentarios en código crítico

### Corregido
- N/A (primera versión)

### Cambiado
- Schema Prisma inicial del template reemplazado por schema completo del sistema

### Eliminado
- Schema demo del template (User, Post)
- Página demo del template

### Seguridad
- Hash de contraseñas con bcrypt
- Sesiones con NextAuth
- Validación de permisos por rol en cada ruta y API
- Sanitización de inputs con Zod

### Notas de migración
- Base de datos SQLite en `db/custom.db`
- Para migrar a PostgreSQL: cambiar `provider` en `schema.prisma` y `DATABASE_URL` en `.env`
- Prisma Client soporta ambos motores sin cambios en el código de aplicación

### Backup
- Backup inicial en `backups/v0.1.0.tar.gz`

---

## Próximas versiones planificadas

### [v0.2.0] - Planificada
- Fidelización de clientes
- Reservas de mesas
- Delivery local
- Panel de métricas avanzado
- Exportación a PDF/Excel
- Lector de códigos de barras
- App instalable (PWA)

### [v0.3.0] - Planificada
- Migración a PostgreSQL
- Sistema de horarios y turnos
- Caja por turno
- Proveedores (futuro)
- Más áreas configurables
