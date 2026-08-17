# SoftLBA — POS Reconstruction Master Plan

**Fecha:** 2026-08-16
**Versión:** v1.0.20-rc33 → v1.1.0 (reconstrucción POS)
**Tipo:** Documento de trabajo contractual — reconstrucción del POS de Salón
**Fuente:** Instrucciones directas del usuario (Leandro)

---

## RESUMEN EJECUTIVO

Este documento define la reconstrucción completa del frontend del POS de Salón
de SoftLBA. El backend, los servicios de dominio y las APIs existentes se
conservan. La reconstrucción se centra en la capa de presentación del POS.

**Principio fundamental:** Los tests pueden pasar, pero si la operación
manual del POS no funciona correctamente, el producto está roto.

---

## 1. AUDITORÍA DEL ESTADO REAL

Antes de cualquier cambio:

1. Auditar repositorio actual en GitHub.
2. Verificar versión REAL del código (package.json, README, CHANGELOG, UI, health).
3. Unificar a UNA SOLA fuente de verdad para APP_VERSION.
4. Comprobar último commit, tags, CI, tests, E2E, build.
5. Comprobar frontend real y API real.

### Fuente única de versión

Debe coincidir en:
- package.json
- README
- CHANGELOG
- UI (appVersionDisplay)
- health endpoint
- GitHub tag
- Documentación

---

## 2. TESTS ≠ FUNCIONAMIENTO REAL

Los tests actuales (469 unit + 27 integration + 59 E2E) pasan, pero la
prueba manual del usuario demuestra problemas funcionales reales:

- Acceso de ADMIN no siempre inicia correctamente.
- Productos DIRECTO (agua, enlatados) no tienen flujo completo SERVIDO → COBRO.
- La pantalla de pedidos no se adapta al flujo deseado.
- Inconsistencias visuales y de UX.

**Regla:** Si un test dice "funciona" pero la prueba manual dice "no funciona",
el producto está roto. Corregir el producto, no maquillar el test.

---

## 3. ARQUITECTURA DEL NUEVO POS

### Pantalla principal del POS = SALÓN (no lista de pedidos)

El dependiente trabaja en SALÓN. Su prioridad es:
1. Ver mesas
2. Abrir una mesa
3. Crear una comanda
4. Añadir productos rápidamente
5. Modificar cantidades
6. Añadir notas
7. Enviar
8. Continuar atendiendo
9. Cobrar cuando corresponda

La pantalla de "Mis pedidos" deja de ser la pantalla principal.
Pasa a ser función secundaria/histórico.

### Layout conceptual

```
┌─────────────────────────────────────────────┐
│ SoftLBA      Mesa 7     Juan       🔔  ☰   │
├─────────────────────────────────────────────┤
│ [ MESAS ] [ PEDIDO ] [ COBRAR ]             │
├──────────────┬──────────────────────────────┤
│ CATEGORÍAS   │ PRODUCTOS                    │
│ 🍔 Comida    │ [Hamburguesa] [Pizza]       │
│ 🍕 Pizza     │ [Coca Cola]  [Agua]         │
│ 🥤 Bebidas  │                              │
│ ⭐ Favoritos │                              │
├──────────────┴──────────────────────────────┤
│ CARRITO                                      │
│ Pizza ×2     $900                           │
│ Agua ×1      $100                          │
│ Subtotal                $1,000              │
│ [ GUARDAR ] [ ENVIAR ] [ COBRAR ]           │
└─────────────────────────────────────────────┘
```

### Responsive

- **Teléfono:** categorías → productos → carrito inferior (bottom sheet)
- **Tablet:** categorías izquierda + productos centro + carrito derecha
- **Desktop:** layout completo

---

## 4. TABLE SELECTOR

Selector de mesas visual conectado al backend (TableService).

Estados: LIBRE 🟢, OCUPADA 🔴, RESERVADA 🟡, ESPERANDO_CUENTA 🔵, LIMPIEZA ⚪

Cuando una mesa está ocupada, otro dependiente NO puede tomarla.
Debe respetar TableService y las reglas atómicas del backend.

---

## 5. CREACIÓN DE PEDIDO — RÁPIDO

Minimizar clics:
- Mesa → Categoría → Producto → + (agregado)
- Cantidades: [-] 2 [+] y botones [+1] [+2] [+5]
- Notas por item: "Sin cebolla", "Extra queso"

### Líneas independientes

NO agrupar automáticamente líneas con notas/modificadores distintos:
```
Pizza Margarita ×1  "Sin cebolla"
Pizza Margarita ×1  "Extra queso"
```
Son DOS líneas, no una con cantidad ×2.

---

## 6. PRODUCTOS DIRECTO — FLUJO COMPLETO

```
AGUA (DIRECTO)
→ SALÓN
→ DESPACHAR
→ SERVIDO
→ COBRABLE
```

NO pasa por COCINA, PIZZERÍA ni KDS.

El dependiente debe poder:
1. Crear pedido
2. Agregar Agua
3. Enviar
4. Marcar/registrar SERVIDO
5. Cobrar

Sin que el producto quede eternamente pendiente.

---

## 7. PEDIDOS NO DOMINAN EL POS

El flujo está integrado en:
```
MESA → PEDIDO → ESTADO → COBRO
```

La vista histórica de pedidos ("Historial") existe aparte, no domina.

---

## 8. ROUTING POR ÁREA

Un pedido puede contener:
- Pizza → PIZZERÍA
- Hamburguesa → COCINA
- Agua → SALÓN

Cada estación recibe EXCLUSIVAMENTE sus productos.

### Tickets independientes por área

```
PEDIDO #1050

PIZZERÍA: Pizza ×2 "Sin cebolla"
COCINA: Hamburguesa ×1 "Extra queso"
SALÓN: Agua ×2
```

Garantizado EN EL BACKEND, no solo en frontend.

---

## 9. IMPRESIÓN — PRIORIDAD 1

Antes de KDS, implementar impresión correctamente.

### AreaConfig

```typescript
type OutputMode = 'DISPLAY' | 'PRINTER' | 'DISPLAY_AND_PRINTER' | 'AUTO'
```

Configurable desde Administración.

### Flujo de impresión

```
POS → Pedido → OrderItem → Area routing → PrintJob → Printer
```

La impresión es CONSECUENCIA de la creación del pedido, no la fuente.

### PrintJob

```typescript
interface PrintJob {
  id: string        // printJobId único
  orderId: string
  areaId: string
  printerId: string
  status: 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'CANCELLED'
  attempts: number
  createdAt: Date
  printedAt?: Date
  error?: string
}
```

Idempotencia: si se intenta imprimir el mismo ticket dos veces, no duplicar.

### Si la impresora falla

NO perder el pedido. Mostrar:
- "Impresora no disponible"
- [ Reintentar ] [ Cambiar impresora ] [ Ver cola ] [ Imprimir manualmente ]
- Si existe KDS: [ Enviar a pantalla ]

---

## 10. COLA DE IMPRESIÓN

Administración → Impresión → Cola

```
Pedido #200  COCINA    PENDING
Pedido #201  PIZZERÍA  FAILED
Pedido #202  COCINA    PRINTED
```

Acciones: Reintentar, Cancelar, Ver ticket, Probar impresora.

---

## 11. CONFIGURACIÓN DE IMPRESORAS

Administración → Impresoras

Campos:
- nombre, área, IP/hostname, puerto, protocolo
- tamaño de papel (58mm/80mm), caracteres por línea
- logo, encabezado, pie, copias, activo/inactivo

---

## 12. ORDEN DE IMPLEMENTACIÓN

```
PRIORIDAD 1: POS → Pedido → Routing → Print Job → Impresora
PRIORIDAD 2: POS → Pedido → Routing → KDS (DISPLAY)
```

El sistema permite escoger PRINTER o KDS sin modificar el flujo del POS.

---

## 13. LO QUE SE CONSERVA

### Backend (NO BORRAR)
- Prisma + schema
- Autenticación (token 5-part, authVersion)
- InventoryService
- TableService
- MoneyService
- ProductAreaResolver
- Pagos (idempotencia)
- Realtime (Socket.IO)
- Auditoría
- APIs existentes que funcionen

### Frontend (CONSERVAR)
- Design System (StatusBadge, EmptyState, ErrorState, status-config)
- Hooks (use-current-user, use-realtime, use-connectivity, use-mounted, use-beep)
- Lib (api.ts, app-version.ts, idempotency.ts, order-utils.ts)
- Components (panel-layout, notification-bell, connectivity-banner)
- Service Worker + PWA
- Docker + deploy

### Frontend (RECONSTRUIR)
- `/mesero` (pantalla principal → SALÓN con mesas)
- `/mesero/nuevo-pedido` (integrado en la vista de mesa)
- Navegación POS relacionada
- Componentes específicos del POS

---

## 14. FEATURES A PREPARAR (no todas ahora)

La arquitectura debe permitir:
- Modificadores, combos, favoritos, categorías
- Búsqueda, códigos de barras, cantidades rápidas
- Notas, descuentos autorizados, promociones
- División de cuenta, múltiples pagos, CUP/USD, cambio
- Impresión, reimpresión, cancelaciones, devoluciones
- Reabrir pedido con autorización
- Transferencia/fusión/separación de mesas
- Cliente, historial, propina, takeaway, delivery futuro

---

## 15. EXPERIENCIA VISUAL

- MODERNA, PROFESIONAL, RÁPIDA, LIMPIA, TÁCTIL, RESPONSIVE
- NO: exceso de tarjetas, texto, dashboard, listas largas, botones pequeños
- Mobile-first: teléfono (categorias→productos→carrito inferior)
- Tablet: categorías izquierda + productos centro + carrito derecha
- Desktop: layout completo

---

## 16. TESTS OBLIGATORIOS

1. LOGIN ADMIN
2. LOGIN MESERO
3. CREAR PEDIDO
4. CREAR PEDIDO CON DIRECTO
5. DIRECTO → SERVIDO
6. DIRECTO → COBRABLE
7. MULTIÁREA
8. TICKET COCINA SOLO SUS ITEMS
9. TICKET PIZZERÍA SOLO SUS ITEMS
10. IMPRESIÓN
11. PRINT JOB
12. RETRY PRINT JOB
13. IDEMPOTENCIA PRINT JOB
14. DOS MESEROS Y MISMA MESA
15. DOS MESEROS Y ÚLTIMA UNIDAD
16. DOBLE PAGO
17. CANCELACIÓN
18. REIMPRESIÓN
19. ERROR DE IMPRESORA
20. RECONEXIÓN

---

## 17. E2E REAL

```
LOGIN MESERO → SALÓN → Mesa 7 → Nuevo pedido
→ Pizza ×1 + Hamburguesa ×1 + Agua ×2 → Enviar

Resultado:
  PIZZERÍA: Pizza
  COCINA: Hamburguesa
  SALÓN: Agua
```

El dependiente NO debe navegar a pantalla de "pedidos" para hacer esto.

---

## 18. PROBLEMA DE LOGIN ADMIN

Reproducir y corregir el problema real de login ADMIN.
Probar desde: navegador móvil, desktop, sesión nueva, sesión expirada,
cookies limpias, producción, LAN.

No considerar cerrado porque un test simple pase.

---

## 19. GITHUB PROFESIONAL

Completar Community Standards:
- Code of Conduct
- Security Policy
- Issue Templates (forms)
- Pull Request Template
- Dependabot
- Release workflow

---

## 20. DEFINICIÓN DE TERMINADO

Esta fase NO se considera terminada hasta que se pueda hacer manualmente:

```
LOGIN MESERO → SALÓN → MESA → NUEVO PEDIDO
→ AGUA + HAMBURGUESA + PIZZA → ENVIAR
```

Resultado real:
- SALÓN: Agua (SERVIDA, cobrable)
- COCINA: Hamburguesa (elabora, lista, servida)
- PIZZERÍA: Pizza (elabora, lista, servida)
- Cada uno únicamente con sus productos
- El pedido puede cobrarse cuando las condiciones del negocio estén satisfechas
- No existen estados eternamente pendientes

---

## 21. OBJETIVO FINAL

Un POS que un dependiente pueda aprender en minutos y usar durante horas
sin luchar contra la interfaz.

```
MESA → PRODUCTOS → ENVIAR → ROUTING → IMPRESORA/KDS → PRODUCCIÓN → DESPACHO → COBRO
```

El dependiente no piensa en áreas. El sistema lo hace automáticamente.
El cocinero no busca sus productos. El sistema se los muestra.
La pizzería no ve hamburguesas. La cocina no ve pizzas.
El salón no espera que un directo pase por producción.

**PRIMERO HACER ESTO PERFECTAMENTE.**

Después: KDS, Android, notificaciones, CMS, analítica, funciones avanzadas.
