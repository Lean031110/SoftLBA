# CHANGELOG - Sistema de Restaurante Cuba

Todo los cambios notables del proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).

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
