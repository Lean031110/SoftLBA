# SoftLBA — Design System

**Última actualización:** 2026-08-14 (FRONTEND-03)
**Versión base:** v1.0.20-rc18
**Fuente de verdad:** `src/app/globals.css` (tokens) + `src/lib/status-config.ts` (estados)

> Documenta los tokens visuales, componentes base y patrones de SoftLBA.
> Creado en FRONTEND-03 (sección 22-23 del plan maestro). Las fases
> FRONTEND-04+ consumirán estos tokens y componentes.

---

## 1. Tokens visuales (CSS variables)

Definidos en `src/app/globals.css` bajo `:root` y `.dark`. Base: shadcn/ui New York con oklch.

### Colores base
| Token | Light | Dark | Uso |
|---|---|---|---|
| `--background` | oklch(1 0 0) | oklch(0.145 0 0) | Fondo de página |
| `--foreground` | oklch(0.145 0 0) | oklch(0.985 0 0) | Texto principal |
| `--card` | oklch(1 0 0) | oklch(0.205 0 0) | Fondo de tarjetas |
| `--popover` | oklch(1 0 0) | oklch(0.205 0 0) | Fondo de popovers |
| `--primary` | oklch(0.546 0.215 262.88) (#2563eb) | oklch(0.623 0.188 259.81) (#3b82f6) | Acciones primarias |
| `--secondary` | oklch(0.97 0.012 250) | oklch(0.269 0.03 255) | Acciones secundarias |
| `--muted` | oklch(0.97 0 0) | oklch(0.269 0 0) | Fondo muted |
| `--muted-foreground` | oklch(0.556 0 0) | oklch(0.708 0 0) | Texto secundario |
| `--accent` | oklch(0.94 0.05 255) | oklch(0.269 0.03 255) | Hovers, selección |
| `--destructive` | oklch(0.577 0.245 27.325) | oklch(0.704 0.191 22.216) | Acciones destructivas |
| `--border` | oklch(0.922 0 0) | oklch(1 0 0 / 10%) | Bordes |
| `--ring` | oklch(0.546 0.215 262.88) | oklch(0.623 0.188 259.81) | Focus ring |
| `--input` | oklch(0.922 0 0) | oklch(1 0 0 / 15%) | Fondo de inputs |

### Radios
| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | calc(0.625rem - 4px) = 6px | Badges, chips pequeños |
| `--radius-md` | calc(0.625rem - 2px) = 8px | Inputs, buttons |
| `--radius-lg` | 0.625rem = 10px | Cards, dialog |
| `--radius-xl` | calc(0.625rem + 4px) = 14px | Modales grandes |

### Charts
5 colores para charts (`--chart-1` a `--chart-5`), sincronizados con `--primary`.

### Sidebar
Tokens dedicados para sidebar (`--sidebar`, `--sidebar-foreground`, etc.) — gestionados por `next-themes` + shadcn sidebar.

---

## 2. Componentes base

### shadcn/ui (44 archivos en `src/components/ui/`)
Librería estándar New York. Lista completa en `src/components/ui/`. Componentes clave:
- `Button` (variantes: default, outline, ghost, destructive, secondary, link; sizes: sm, md, lg, icon)
- `Input`, `Textarea`, `Label`
- `Select`, `Checkbox`, `Switch`, `RadioGroup`
- `Dialog`, `AlertDialog`, `Sheet`, `Drawer`, `Popover`, `Tooltip`
- `Card`, `Badge`, `Avatar`, `Separator`, `ScrollArea`
- `Table`, `Tabs`, `Accordion`, `Collapsible`
- `Toast` (sonner wrapper), `Skeleton`
- `Sidebar` (mobile drawer + desktop aside)

### Componentes SoftLBA (post-FRONTEND-03)

#### `StatusBadge` — `src/components/ui/status-badge.tsx`
Badge tipado para estados de SoftLBA. Consume mapas de `src/lib/status-config.ts`.

```tsx
import { StatusBadge } from '@/components/ui/status-badge'

<StatusBadge kind="order" value="ENVIADO" />
<StatusBadge kind="table" value="LIBRE" size="sm" />
<StatusBadge kind="item" value="LISTO" showDot />
<StatusBadge kind="payment" value="PAGADO" />
<StatusBadge kind="user-active" value={user.isActive} />
```

Variantes:
- `kind`: `"order" | "table" | "item" | "payment" | "user-active"`
- `value`: string (status) o boolean (para `user-active`)
- `size`: `"sm"` (tablas compactas) | `"md"` (default, headers)
- `showDot`: añade punto de color antes del label
- `labelOverride`: sobreescribir el label

Fallback seguro: status desconocido → badge gris con el valor crudo como label.

#### `EmptyState` — `src/components/ui/empty-state.tsx`
Empty state consistente para listas vacías.

```tsx
import { EmptyState } from '@/components/ui/empty-state'
import { Users } from 'lucide-react'

<EmptyState
  icon={<Users className="h-8 w-8" />}
  title="No hay usuarios"
  description="Crea el primer usuario con el botón de arriba."
  action={<Button>Crear usuario</Button>}
/>
```

Props: `icon`, `title`, `description?`, `action?`, `compact?`.

#### `ErrorState` — `src/components/ui/error-state.tsx`
Error state con icono, descripción, error opcional y acciones de retry.

```tsx
import { ErrorState } from '@/components/ui/error-state'

<ErrorState
  title="No se pudo cargar el pedido"
  description="Verifica tu conexión e inténtalo de nuevo."
  error={error}
  onRetry={() => load()}
/>
```

Props: `title?`, `description?`, `error?`, `onRetry?`, `retryLabel?`, `secondaryAction?`, `compact?`.

Usado por los `error.tsx` en `/admin`, `/mesero`, `/cocina`, `/pizzeria`, y `/` (root).

### Componentes SoftLBA existentes (pre-FRONTEND-03)

#### `LoadingScreen`, `LoadingCard`, `LoadingSpinner`, `LoadingOverlay`
En `src/components/loading.tsx`. Pantallas de carga con logo SoftLBA.

#### `ConnectivityBanner`
En `src/components/layout/connectivity-banner.tsx`. Banner amarillo/rojo cuando el servidor local no responde (FRONTEND-02A, FE-006).

#### `NotificationBell`
En `src/components/layout/notification-bell.tsx`. Bell + popover con notificaciones.

#### `PanelLayout`
En `src/components/layout/panel-layout.tsx`. Layout principal con sidebar + header + footer.

#### `KitchenDashboard`
En `src/components/kitchen/kitchen-dashboard.tsx`. KDS de cocina/pizzería con tabs sticky.

#### `ServiceWorkerRegister`
En `src/components/service-worker-register.tsx`. Registra SW + escucha `SW_UPDATED`.

---

## 3. Mapas de estados

Centralizados en `src/lib/status-config.ts`. Una sola fuente de verdad para labels, colores e iconos de cada status.

### Order status (9 estados)
`CREADO`, `ENVIADO`, `EN_PREPARACION`, `LISTO`, `SERVIDO`, `DESPACHADO`, `COBRADO`, `CANCELADO`, `ARCHIVADO`

### Table status (5 estados)
`LIBRE`, `OCUPADA`, `RESERVADA`, `ESPERANDO_CUENTA`, `LIMPIEZA`

### Order item status (6 estados)
`PENDIENTE`, `EN_PREPARACION`, `LISTO`, `DESPACHADO`, `SERVIDO`, `CANCELADO`

### Payment status (3 estados)
`PENDIENTE`, `PARCIAL`, `PAGADO`

### User active status (2 estados)
`active`, `inactive`

### Helpers con fallback
- `getOrderStatusConfig(status)` — fallback gris neutro si status desconocido.
- `getTableStatusConfig(status)`
- `getOrderItemStatusConfig(status)`
- `getPaymentStatusConfig(status)`

---

## 4. Patrones UX

### Touch targets
- **Mínimo 40px** (`h-10`) para botones primarios en mobile.
- **Mínimo 44px** (`h-11`) recomendado WCAG 2.5.5 (cuando sea posible).
- Icon-only buttons requieren `aria-label` descriptivo.

### Sticky headers / actions
- Header global: `sticky top-0 z-30` (PanelLayout).
- Tabs en cocina: `sticky top-16 z-20 bg-background` (debajo del header).
- Acciones en pedido detail: `sticky bottom-0 z-20 backdrop-blur` (mobile/tablet).

### Mobile-first responsive
- Base mobile: 1 columna.
- `sm:` (640px+): 2 columnas.
- `md:` (768px+): sidebar lateral + tablas.
- `lg:` (1024px+): 3 columnas + layouts completos.

### Listas largas
- Cap inicial: renderizar primeros 50 items.
- "Cargar más" con IntersectionObserver para los siguientes 50.
- Virtualización solo si >200 items (caso raro en POS).
- Pendiente de implementar (P3).

### Modales en mobile
- `Dialog` estándar para diálogos cortos.
- `Sheet side="bottom"` para formularios largos (pagos, edición).
- Pendiente de migrar el modal de pago a Sheet (FRONTEND-04).

### Estados UI obligatorios (sección 40 del plan)
Cada pantalla debe tener:
- `LOADING` — usar `LoadingScreen` o `Skeleton`.
- `EMPTY` — usar `EmptyState`.
- `SUCCESS` — contenido principal.
- `ERROR` — usar `ErrorState` o `error.tsx`.
- `OFFLINE` — `ConnectivityBanner` se muestra automáticamente.

---

## 5. Tipografía

- **Font sans:** Geist Sans (configurado en `src/app/layout.tsx`).
- **Font mono:** Geist Mono.
- Tamaños Tailwind estándar. Evitar `text-[10px]` excepto para badges decorativos.

### Jerarquía
| Tailwind | px | Uso |
|---|---|---|
| `text-xs` | 12px | Metadata, badges, captions |
| `text-sm` | 14px | Body compacto, inputs |
| `text-base` | 16px | Body default |
| `text-lg` | 18px | Subtítulos |
| `text-xl` | 20px | Títulos de página (h1) |
| `text-2xl` | 24px | Títulos grandes (hero) |

---

## 6. Animaciones

- `tw-animate-css` importado en `globals.css`.
- `prefers-reduced-motion: reduce` respeta reducción (FE-015, FRONTEND-02C).
- Animaciones permitidas: pulse (skeletons), spin (loaders), slide-in/out (Sheet/Dialog).
- Prohibido: animaciones constantes, rebotes, transiciones largas.

---

## 7. Próximos pasos (FRONTEND-04+)

### Pendiente de crear
- `IconButton` — wrapper de Button con aria-label forzado.
- `ConfirmDialog` — wrapper de AlertDialog con props simplificadas.
- `DataTable` — wrapper de Table con paginación + sort.
- `ProductCard` — card estándar para productos en POS.
- `OrderCard` — card estándar para pedidos en KDS.
- `Cart` — contenedor de carrito con qty/remove.

### Pendiente de migrar
- 54+ badges hardcoded → `StatusBadge` (incremental, pantalla por pantalla).
- 25+ empty states inline → `EmptyState`.
- 100+ `fetch()` directos → `apiFetch` (FRONTEND-03 fue la base; migración completa en FRONTEND-04+).

### No crear
- No crear componentes por crear. Solo si hay ≥3 usos reales identificados.
- No duplicar shadcn/ui. Si existe, usarlo.
- No añadir librerías nuevas (Framer Motion, react-hook-form, etc.) sin necesidad demostrada.
