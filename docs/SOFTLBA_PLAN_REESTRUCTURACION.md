# SoftLBA - Plan Maestro de Reestructuración del Frontend y Sistema Operacional

> **DOCUMENTO FUENTE DE VERDAD** — Pegado por el usuario el 2026-08-19.
> Cualquier conflicto entre este documento y `docs/PLAN_POS_PRODUCCION.md`
> (plan anterior de consolidación) se resuelve a favor de este.

## Objetivo

Reconstruir completamente el frontend operacional de SoftLBA, conservando la administración por ahora y reutilizando el backend, autenticación, Prisma, servicios de dominio e infraestructura que ya estén correctos.

La nueva interfaz debe ser simple, rápida, minimalista y pensada para un restaurante real. El objetivo no es tener una UI llamativa, sino una herramienta de trabajo robusta.

## Importante sobre la revisión

El preview proporcionado no pudo ser abierto desde el entorno de revisión. La URL devolvió un fallo de obtención/cache, por lo que esta fase no debe afirmar que se realizó una prueba manual del preview. El análisis se apoya en el repositorio de GitHub y en los problemas reportados durante las pruebas manuales.

El repositorio ya contiene avances importantes: POS reconstruido, routing por áreas, impresión ESC/POS, Print Worker, realtime, diagnóstico, logging y herramientas de soporte. Los últimos commits muestran 511 tests, 0 errores TypeScript/ESLint y build exitoso, pero también documentan explícitamente funcionalidades todavía no verificadas como UI POS completa, KDS móvil/ADDED_LATE/recall/EXPO, recibo PDF y pruebas E2E reales de concurrencia.

## Problemas y riesgos que deben conservarse como contexto

- La UI operacional ha cambiado varias veces y ha perdido funcionalidad entre versiones.
- El frontend actual debe sustituirse de forma controlada, pero no se debe borrar el backend.
- El flujo real del restaurante debe ser la fuente de verdad de la UX.
- El routing por área debe producir tickets/KDS por estación, no pedidos completos en todas las áreas.
- Impresión y KDS deben ser dos salidas del mismo flujo de producción.
- Las pruebas unitarias no bastan: deben existir pruebas de integración y E2E que reproduzcan el trabajo real de un dependiente.

## Reglas para la IA

1. Descargar/obtener el repositorio actual de GitHub antes de modificarlo.
2. Crear una rama de trabajo dedicada antes de realizar cambios grandes.
3. No eliminar `src/app/admin`, `src/components/admin`, rutas/API administrativas ni servicios backend utilizados por administración.
4. Antes de borrar cualquier carpeta frontend, crear un inventario de dependencias y rutas.
5. Eliminar/reemplazar únicamente el frontend operacional no administrativo.
6. Mantener backend, Prisma, auth, permisos, inventario, mesas, pedidos, pagos, realtime, impresión y auditoría salvo que la auditoría demuestre que una pieza está obsoleta.
7. No copiar código propietario de AxisPOS, Toast, Square o cualquier otro producto. Utilizar solo ideas funcionales y patrones de UX.
8. Cada fase debe terminar con validación y registro en este documento.
9. No declarar una funcionalidad como completa si solo está simulada o probada con mocks.
10. Mantener `download/` y `upload/` fuera de los paquetes de release.

# Fase 0 - Preparación y respaldo

### Acciones
- Crear rama `refactor/frontend-v2`.
- Etiquetar el estado actual antes del borrado del frontend operacional.
- Ejecutar `bun run doctor`.
- Ejecutar typecheck, lint, tests y build.
- Crear bundle de diagnóstico.
- Guardar lista de rutas frontend existentes.
- Guardar lista de APIs utilizadas por cada pantalla.

### Entregables
- `docs/FRONTEND_REBUILD_PLAN.md`
- etiqueta Git de seguridad
- diagnóstico inicial

# Fase 1 - Definir frontera de conservación

## Conservar
- administración
- API
- Prisma
- auth
- permisos
- InventoryService
- TableService
- MoneyService
- ProductAreaResolver
- PrintService
- Print Worker
- realtime
- notificaciones
- auditoría
- health/doctor/diagnostics

## Reemplazar
- POS de Salón
- flujo de creación de pedido
- experiencia de carrito
- pantallas de Cocina
- pantallas de Pizzería
- interfaces de producción
- histórico operacional si resulta incompatible con el nuevo flujo
- componentes duplicados de las áreas no administrativas

# Fase 2 - Arquitectura de frontend nueva

```text
src/app/
  admin/                 # conservar
  pos/                   # nuevo POS de salón
  production/            # base reutilizable de producción
  cocina/                # experiencia cocina
  pizzeria/              # experiencia pizzería
  expo/                  # futura expedición

src/components/
  pos/
  production/
  printing/
  realtime/
  notifications/
  shared/
  admin/                 # conservar
```

Evitar copiar componentes de una estación a otra. Crear primitives reutilizables donde el comportamiento es común y dejar configuración visual/operativa por área.

# Fase 3 - POS de Salón desde cero

## Objetivos visuales
- minimalista
- pocos elementos
- alto contraste
- botones táctiles grandes
- jerarquía clara
- nada oculto detrás de otro elemento
- una sola acción primaria en cada contexto
- responsive real
- sin duplicados

## Diseño base

### Teléfono
- barra superior pequeña
- selector de mesa arriba
- categorías deslizable
- productos en grid compacto
- carrito fijo abajo
- acciones de enviar/cobrar siempre accesibles

### Tablet/desktop
- mesas a la izquierda
- productos al centro
- carrito persistente a la derecha

## Flujo principal
```text
Mesero
  ↓
Selecciona mesa
  ↓
Nombre opcional del cliente
  ↓
Añade productos
  ↓
Carrito muestra cantidad y total
  ↓
Abre carrito
  ↓
Nombre/comentario/descuento opcionales
  ↓
ENVIAR
```

## Requisitos de carrito
- una sola representación del carrito
- badge con cantidad total de unidades
- total siempre visible
- líneas independientes si cambian notas/modificadores
- cantidades +/−
- eliminar línea
- notas por línea
- comentario general
- descuento si el permiso lo permite
- botón ENVIAR persistente
- loading con timeout
- reintento con la misma idempotency key

# Fase 4 - Flujo de pedido real

Caso obligatorio de prueba:
```text
Mesa 7
Cliente: Carlos

Agua x2
Pizza x1
Hamburguesa x1
Espaguetis x1
```

Resultado esperado:
```text
SALÓN
  Agua x2

PIZZERÍA
  Pizza x1

COCINA
  Hamburguesa x1
  Espaguetis x1
```

Ninguna estación recibe productos de otra.

# Fase 5 - Producto directo

Productos como agua, refrescos, enlatados, productos sin producción siguen:
```text
PEDIDO
 ↓
DIRECTO
 ↓
SERVIDO pendiente de confirmación
 ↓
notificación al mesero
 ↓
CONFIRMAR SERVIDO
```

No deben aparecer en KDS ni en tickets de producción.

# Fase 6 - Producción: cocina y pizzería

Reconstruir desde cero las pantallas operacionales.

## Estados
Cocina y Pizzería solo necesitan:
- EN_PREPARACION
- LISTO

`SERVIDO` pertenece al flujo de salón/cliente.

## KDS
Debe soportar:
- teléfono
- tablet
- monitor grande
- fullscreen
- tickets grandes
- antigüedad
- prioridad
- notas
- modificadores
- sonido
- recall
- estados claros

Inspirarse en patrones de KDS modernos: routing por estación, tickets por prep station, orden por antigüedad, alertas de cambios y vista de expedición.

# Fase 7 - Modo teléfono para elaboradores

Si el dispositivo no es un KDS dedicado:
```text
INTRODUCIR COMANDA
[____]
[CONFIRMAR]
```

Después mostrar solo esa comanda y los items de esa estación.

Acciones:
- EN PREPARACIÓN
- LISTO

Al completar: volver a introducir comanda.

# Fase 8 - Impresión

El flujo debe ser:
```text
Order
 ↓
Routing
 ↓
PrintJob
 ↓
Print Worker
 ↓
Printer
```

No bloquear la creación del pedido esperando la impresora.

## Output modes
- DISPLAY
- PRINTER
- DISPLAY_AND_PRINTER
- AUTO

La configuración debe ser por área.

## Tickets
Cada ticket debe contener solo los productos de esa estación.

Ejemplo:
```text
PIZZERÍA
Pedido #1050
Mesa 7

2 x Pizza Margarita
Sin cebolla
```

No incluir Hamburguesa ni Agua.

## Colas
Estados:
- PENDING
- PRINTING
- PRINTED
- FAILED
- CANCELLED

Con:
- retries
- backoff
- fallback printer
- timeout
- error visible
- idempotencia

# Fase 9 - Recibo después del pago

Al cobrar:
1. Si hay impresora de salón, imprimir automáticamente.
2. Si no hay impresora, generar factura descargable.
3. Notificar al mesero.
4. No bloquear el cobro por fallo de impresión.

# Fase 10 - Modificaciones de pedidos

Si el pedido ya está en preparación y se agrega un producto:
- crear item nuevo
- marcarlo como ADDED_LATE
- conservar timestamp de incorporación
- mostrarlo al final
- resaltarlo
- imprimirlo como añadido si aplica
- mostrarlo en KDS como añadido
- ordenar por antigüedad de espera

Si se modifica o cancela un item existente:
- registrar cambio
- resaltarlo
- notificar a la estación

# Fase 11 - Realtime

Debe existir:
```text
DB COMMIT
 ↓
Evento backend
 ↓
Socket.IO
 ↓
rooms derivadas del backend
```

El frontend nunca emite eventos de negocio.

Verificar aislamiento:
- cocina no recibe pizzería
- pizzería no recibe cocina
- salón no recibe eventos internos irrelevantes

Además:
- authVersion
- reconexión
- token refresh
- disconnect
- stale sockets
- deduplicación
- orden de eventos

# Fase 12 - Notificaciones

Capas:
1. notificación interna
2. realtime
3. Web Notification + Service Worker cuando existe secure context
4. Android nativo más adelante

La campanilla solo muestra punto si:
- hay no leídas
- hay acción pendiente
- o hay que activar notificaciones

No mantener un punto permanente.

Para Chrome en LAN, diagnosticar explícitamente `window.isSecureContext`, `Notification.permission`, Service Worker y PushManager.

# Fase 13 - Indicador de conexión

En la barra principal:
```text
Servidor  🟢 24 ms
Realtime  🟢
```

Estados:
- verde
- amarillo
- rojo
- sin conexión

# Fase 14 - Desarrollo local

Crear:
```text
bun run dev:all
```

Debe iniciar:
- Next
- realtime
- print worker

con shutdown correcto.

# Fase 15 - Logging y diagnóstico

Crear:
```text
logs/
  backend.log
  realtime.log
  printer.log
  frontend.log
  turbopack.log
  dev-all.log
```

La terminal no debe llenarse con ruido innecesario de Prisma. Mantener WARN/ERROR/FATAL visibles.

Crear:
```text
bun run doctor
bun run diagnose:turbopack
bun run collect:diagnostics
bun run support:bundle
```

El bundle de soporte no debe contener:
- .env
- tokens
- cookies
- passwords
- base de datos completa
- backups privados

# Fase 16 - Tests

No considerar terminado con tests unitarios únicamente.

Crear:
- unit
- integration con SQLite real
- E2E
- pruebas manuales documentadas

Casos obligatorios:
1. Login mesero
2. Login admin
3. Crear pedido
4. Pedido mixto
5. Producto directo
6. Última unidad de stock
7. Misma mesa en paralelo
8. Doble envío
9. Doble pago
10. Impresora caída
11. Printer fallback
12. KDS
13. Modo teléfono
14. Añadir item durante preparación
15. Cancelar item durante preparación
16. Realtime por área
17. Reconexión
18. Notificación
19. Receipt
20. Restore/backups

# Fase 17 - Backend que falte para soportar el frontend

Si la nueva UX requiere algo que el backend aún no tiene, primero comprobar si existe una API equivalente.

Si existe y es insuficiente: mejorarla.
Si no existe: crearla siguiendo la arquitectura de servicios.

No poner lógica de negocio importante en React.

# Fase 18 - Escandallo y recetas

Después de estabilizar el POS, implementar un backend de recetas profesional.

Debe soportar:
- ingredientes
- unidades de compra
- unidades de consumo
- conversiones
- rendimiento
- merma
- coste unitario
- coste de receta
- coste por porción
- food cost %
- margen
- subrecetas
- histórico de costes
- versiones de receta
- consumo transaccional de inventario

Inspirarse funcionalmente en sistemas de food costing/recipe management y en POS open source.

# Fase 19 - Escandallo avanzado

Modelo conceptual:
```text
Ingrediente
 ↓
Unidad de compra
 ↓
Rendimiento / merma
 ↓
Coste usable
 ↓
Subreceta
 ↓
Receta final
 ↓
Coste por porción
 ↓
Food cost %
 ↓
Margen
```

Si cambia el precio de un ingrediente:
- recalcular recetas afectadas
- mantener histórico
- no modificar retrospectivamente operaciones cerradas

# Fase 20 - Backoffice futuro

No modificar la administración actual ahora salvo lo necesario para soportar:
- áreas
- impresoras
- output mode
- KDS
- routing
- recetas
- escandallo
- costes

La gran reconstrucción de administración queda para después.

# Criterios de terminado

La nueva arquitectura debe conseguir este flujo completo:
```text
Mesero
 ↓
Mesa 7
 ↓
Cliente Carlos
 ↓
Agua x2
Pizza x1
Hamburguesa x1
Espaguetis x1
 ↓
ENVIAR
 ↓
SALÓN → Agua
PIZZERÍA → Pizza
COCINA → Hamburguesa + Espaguetis
```

Si el área usa impresora: → ticket correcto.
Si usa KDS: → ticket visible solo en esa estación.
Si usa ambos: → ambos sin duplicados.
Si es directo: → notificación de confirmación al mesero.
Al completar producción: → notificación al mesero.
Al cobrar: → receipt impreso si existe impresora de salón, factura descargable si no.

# Release

No generar release final hasta tener:
- 0 TypeScript errors
- 0 ESLint errors
- tests verdes
- integration verdes
- E2E verdes
- build verde
- versionado consistente
- doctor sin FAIL
- impresión real verificada si el hardware está disponible
- documentación actualizada

# Recursos externos utilizados como referencia

- Toast Kitchen Routing / Prep Stations: routing por estación, asignación de menú/modificadores y destino KDS/impresora.
- Toast KDS: tickets, antigüedad, sonidos, cambios en tiempo real y expediter.
- Square KDS: routing desde POS hacia estaciones y configuración por dispositivo.
- `ahmedali5530/restaurant-pos`: ejemplo open source de POS/KDS con routing y workflows multietapa.
- Floreant POS: ejemplo open source de POS de restaurante con tickets, mesas, impresión de cocina y funcionalidades de food cost.
- Kitchen-POS: ejemplo open source de POS React/Electron con impresión térmica y arquitectura documentada.

# Regla final

No quiero una interfaz nueva que simplemente se vea mejor.
Quiero un sistema operacional mejor.

El frontend debe simplificar la vida del trabajador.
El backend debe ser la fuente de verdad.
La impresión y el KDS deben compartir el mismo routing.
Realtime y notificaciones deben ser consecuencias de cambios reales en la base de datos.
Y el escandallo debe convertir SoftLBA en una herramienta real de control de costes, no solamente un POS con recetas.
