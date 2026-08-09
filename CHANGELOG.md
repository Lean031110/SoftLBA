# CHANGELOG - Sistema de Restaurante Cuba

Todo los cambios notables del proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).

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
