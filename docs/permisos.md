# Matriz de Permisos - Sistema de Restaurante Cuba

## Roles

| Rol | Descripción | Color badge |
|-----|-------------|-------------|
| ADMIN | Administrador del sistema, acceso total | rojo |
| MESERO | Toma pedidos y cobra (con permiso) | verde |
| COCINA | Ve y procesa pedidos de cocina | ámbar |
| PIZZERIA | Ve y procesa pedidos de pizzería | naranja |
| CAJERO | Finanzas y cierre diario | púrpura |

## Acceso a páginas

| Página | ADMIN | MESERO | COCINA | PIZZERIA | CAJERO |
|--------|:-----:|:------:|:------:|:--------:|:------:|
| `/` (home pública) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/login` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/ayuda` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/admin` (dashboard) | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/admin/usuarios` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/productos` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/recetas` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/inventario-general` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/inventario` | ✅ | ❌ | ✅ | ✅ | ❌ |
| `/admin/noticias` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/clientes` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/promociones` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/finanzas` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/admin/cierre-diario` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/admin/auditoria` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/respaldos` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/configuracion` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/ayuda` (editor) | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/mesero` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/mesero/nuevo-pedido` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/mesero/pedidos/[id]` | ✅ | ✅* | ❌ | ❌ | ❌ |
| `/mesero/pedidos/[id]/comprobante` | ✅ | ✅* | ❌ | ❌ | ❌ |
| `/cocina` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/pizzeria` | ✅ | ❌ | ✅ | ✅ | ❌ |

\* Solo sus propios pedidos

## Permisos de acciones

| Acción | ADMIN | MESERO | COCINA | PIZZERIA | CAJERO |
|--------|:-----:|:------:|:------:|:--------:|:------:|
| **Pedidos** | | | | | |
| Crear pedido | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver propios pedidos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver todos los pedidos | ✅ | ❌ | ✅** | ✅** | ✅ |
| Editar pedido | ✅ | ✅* | ❌ | ❌ | ❌ |
| Cancelar pedido | ✅ | ✅* | ❌ | ❌ | ❌ |
| Cambiar estado (cocina) | ✅ | ❌ | ✅ | ✅ | ❌ |
| Cobrar pedido | ✅ | ✅ | ❌ | ❌ | ✅ |
| Generar comprobante | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Inventario** | | | | | |
| Gestionar inventario general | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestionar inventario de área | ✅ | ❌ | ✅ | ✅ | ❌ |
| Registrar stock físico | ✅ | ❌ | ✅ | ✅ | ❌ |
| Ver comparación teórico/físico | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Finanzas** | | | | | |
| Ver finanzas | ✅ | ❌ | ❌ | ❌ | ✅ |
| Registrar movimiento financiero | ✅ | ❌ | ❌ | ❌ | ✅ |
| Ver libro mayor | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Cierre diario** | | | | | |
| Abrir cierre | ✅ | ❌ | ❌ | ❌ | ✅ |
| Registrar denominaciones | ✅ | ❌ | ❌ | ❌ | ✅ |
| Cerrar/bloquear período | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Administración** | | | | | |
| Gestionar usuarios | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestionar productos | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestionar recetas | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestionar configuración | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestionar noticias | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestionar clientes | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestionar promociones | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestionar ayuda | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver auditoría | ✅ | ❌ | ❌ | ❌ | ❌ |
| Crear/restaurar respaldos | ✅ | ❌ | ❌ | ❌ | ❌ |

\* Solo sus propios pedidos  
\*\* Solo pedidos de su área

## Redirección post-login

| Rol | Página de inicio |
|-----|------------------|
| ADMIN | `/admin` |
| MESERO | `/mesero` |
| COCINA | `/cocina` |
| PIZZERIA | `/pizzeria` |
| CAJERO | `/admin/cierre-diario` |

## Verificación de permisos

### En API routes (backend)

```typescript
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
  if (!['ADMIN', 'CAJERO'].includes(user.role)) {
    return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
  }
  // ...
}
```

### En middleware (todas las rutas)

```typescript
// src/middleware.ts
const ROUTE_ROLE_MAP = [
  { prefix: '/admin', roles: ['ADMIN', 'CAJERO'] },
  { prefix: '/mesero', roles: ['ADMIN', 'MESERO'] },
  // ...
]
```

### En componentes cliente (UI)

```typescript
import { hasPermission, PERMISSIONS } from '@/lib/permissions'

if (hasPermission(user.role, 'CAN_MANAGE_USERS')) {
  // mostrar botón de gestión de usuarios
}
```
