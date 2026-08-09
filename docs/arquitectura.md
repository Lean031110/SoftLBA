# Arquitectura del Sistema - Restaurante Cuba

## Visión general

Sistema integral para restaurante en red local, diseñado para operar sin dependencia de Internet. Permite gestión de pedidos en tiempo real, inventario por áreas, finanzas trazables, cierre diario, auditoría completa y respaldos.

## Stack tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Lenguaje | TypeScript 5 | Tipado estático, reduce errores |
| Frontend | Next.js 16 (App Router) + React 19 | SSR, rutas anidadas, server components |
| Backend | Next.js API Routes | Mismo proceso que frontend, simplifica deploy |
| Tiempo real | Socket.IO (mini-servicio puerto 3003) | Notificaciones push, sync multi-cliente |
| ORM | Prisma 6 | Tipado, migraciones, multi-motor |
| Base de datos | SQLite | Local, sin configuración, migrable |
| Estilos | Tailwind CSS 4 | Utility-first, responsive |
| Componentes | shadcn/ui (New York) | Modernos, accesibles, customizables |
| Iconos | Lucide React | Consistentes, ligeros |
| Animaciones | Framer Motion | Transiciones suaves |
| Auth | Sistema propio con cookies HMAC | Sin dependencia externa |
| Validación | Zod | Tipado en runtime |
| Estado | Zustand + TanStack Query | Cliente + servidor |

## Diagrama de componentes

```
┌─────────────────────────────────────────────────┐
│              Navegador (Cliente)                 │
│  ┌─────────────────────────────────────────┐    │
│  │      Páginas Públicas (/)                │    │
│  │  - Home con noticias y carta             │    │
│  │  - Login                                 │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │      Panel Autenticado                   │    │
│  │  - /admin/*   → Administración          │    │
│  │  - /mesero/*  → Mesero                  │    │
│  │  - /cocina     → Cocina                 │    │
│  │  - /pizzeria   → Pizzería               │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │      Cliente Socket.IO                  │    │
│  │  (useRealtime hook)                     │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│           Caddy Gateway (puerto 81)              │
│  - Proxy a Next.js (3000) por defecto           │
│  - Proxy a mini-servicios con XTransformPort    │
└─────────────────────────────────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌─────────────────┐          ┌──────────────────┐
│  Next.js (3000)  │          │  Realtime (3003) │
│  - App Router    │          │  - Socket.IO     │
│  - API Routes    │          │  - Salas por rol│
│  - Middleware    │          │    y usuario    │
│  - Server comps  │          └──────────────────┘
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Prisma Client   │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  SQLite (file)   │
│  custom.db       │
└─────────────────┘
```

## Modelo de datos

### Entidades principales

1. **User** - Usuarios con roles (ADMIN, MESERO, COCINA, PIZZERIA, CAJERO)
2. **UserProfile** - Perfil extendido (teléfono, dirección, carnet, etc.)
3. **Session** - Sesiones activas
4. **RestaurantConfig** - Configuración singleton del restaurante
5. **News** - Noticias y avisos (públicos o privados)
6. **Area** - Áreas operativas (salón, cocina, pizzería, producción)
7. **Product** - Productos (DIRECTO, FINAL, SUBPRODUCTO)
8. **Recipe** - Recetas con ingredientes
9. **InventoryItem** - Inventario general central
10. **AreaInventory** - Inventario por área
11. **StockMovement** - Movimientos de stock (entrada, salida, traslado, ajuste, merma)
12. **PhysicalStock** - Conteos físicos realizados
13. **Table** - Mesas del restaurante
14. **Order** - Pedidos con estados
15. **OrderItem** - Items de cada pedido
16. **Payment** - Pagos con métodos múltiples
17. **FinanceEntry** - Movimientos financieros
18. **DailyClose** - Cierres diarios con denominaciones
19. **Customer** - Clientes
20. **Promotion** - Promociones
21. **AuditLog** - Trazabilidad completa
22. **Notification** - Notificaciones
23. **HelpArticle** - Ayuda integrada
24. **Backup** - Registro de respaldos

### Estados de pedido

```
CREADO → ENVIADO → EN_PREPARACION → LISTO → SERVIDO → COBRADO → ARCHIVADO
                                                           ↓
                                                       CANCELADO
```

## Autenticación y permisos

### Flujo de autenticación

1. Usuario envía username + password a `/api/auth/login`
2. Servidor verifica con bcrypt, genera token HMAC: `userId.role.expiresAt.signature`
3. Cookie `rc_session` httpOnly, 12 horas de TTL
4. Middleware verifica cookie en cada request y permite/deniega según rol
5. Logout elimina la cookie y registra en auditoría

### Roles y permisos

| Rol | Acceso principal |
|-----|------------------|
| ADMIN | Todo el sistema |
| MESERO | Solo sus pedidos, crear pedidos, cobrar |
| COCINA | Ver pedidos para cocina, cambiar estados |
| PIZZERIA | Ver pedidos para pizzería, cambiar estados |
| CAJERO | Finanzas, cierre diario |

## Tiempo real

### Eventos Socket.IO

| Evento | Origen | Destino |
|--------|--------|---------|
| `order:new` | Mesero crea pedido | Cocina/área + admin |
| `order:status` | Cocina cambia estado | Mesero dueño + admin |
| `order:ready` | Cocina marca "Listo" | Mesero dueño + admin (con sonido) |
| `payment:done` | Mesero cobra | Admin + cajero |
| `stock:low` | Sistema detecta stock bajo | Admin + área |
| `daily-close` | Admin cierra día | Broadcast |
| `notification` | Admin envía aviso | Usuario/rol específico |

### Salas (rooms)

- `role:ADMIN`, `role:MESERO`, etc.
- `user:<userId>` (notificaciones personales)
- `area:<areaId>` (eventos de área específica)

## Migración de base de datos

El sistema está preparado para migrar de SQLite a PostgreSQL/MySQL/MariaDB:

1. Cambiar `provider` en `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"  // o "mysql"
     url      = env("DATABASE_URL")
   }
   ```
2. Actualizar `.env`:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/restaurante
   ```
3. Ejecutar:
   ```bash
   bun run db:push
   ```
4. El código de aplicación NO requiere cambios

## Respaldo y restauración

### Backup automático
- No implementado en v0.1 (planeado para v0.2)

### Backup manual
- Desde `/admin/respaldos` (UI)
- Desde API: `POST /api/admin/respaldos`
- Script CLI: `bun run backup`

### Restauración
- Copia el archivo de backup a `db/custom.db`
- Registra en tabla Backup
- Auto-backup antes de restaurar

## Seguridad

- Hash de contraseñas con bcrypt (10 rounds)
- Cookies httpOnly, sameSite=lax
- Bloqueo temporal tras 5 intentos fallidos (15 min)
- Sanitización de inputs con Zod
- Verificación de rol en cada API y página
- Audit log de acciones sensibles
- Tokens HMAC firmados con SECRET

## Manejo de errores

- Mensajes claros al usuario (toast de sonner)
- Registro de errores en consola
- Estados de error en UI (Alert)
- Recuperación automática (reintentos en WebSocket)
- No se pierden datos ante errores (transacciones en DB)

## Próximos pasos (v0.2+)

- Fidelización de clientes con puntos
- Reservas de mesas
- Delivery local
- App instalable (PWA)
- Exportación PDF/Excel
- Lector de códigos de barras
- Migración a PostgreSQL
- Más áreas configurables
- Horarios y turnos
- Caja por turno
