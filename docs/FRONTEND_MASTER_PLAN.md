# SoftLBA — Frontend Master Plan & Production Stabilization Guide

> Documento maestro de trabajo para IA de desarrollo.
>
> **Repositorio:** https://github.com/Lean031110/SoftLBA  
> **Rama auditada:** `main`  
> **Último commit verificable en GitHub al 2026-08-14:** `32a79d2de091af66af93c7b59ad2216f56f95e4c`  
> **Última serie publicada/verificable:** `v1.0.20-rc13`  
> **Objetivo:** estabilizar y modernizar el frontend sin romper el backend, convertir SoftLBA en un POS profesional mobile-first y dejar preparada la arquitectura para impresión térmica/KDS, Windows/Linux y futuras funcionalidades.

---

# 0. Propósito

Este documento no es una lista genérica de ideas.

Es una **hoja de ruta técnica ejecutable** para que una IA pueda trabajar sobre SoftLBA por iteraciones pequeñas, verificables y reversibles.

La regla es:

```text
AUDITAR
  ↓
AISLAR EL PROBLEMA
  ↓
CORREGIR
  ↓
TESTEAR
  ↓
PROBAR EN PREVIEW
  ↓
COMMIT
  ↓
PUSH
  ↓
CI VERDE
  ↓
DOCUMENTAR
  ↓
SIGUIENTE ITERACIÓN
```

No se permite saltar directamente de un problema a un rediseño completo sin primero comprender la causa.

---

# 1. FUENTE DE VERDAD Y ESTADO REAL

## 1.1 GitHub vs preview local

Durante la revisión apareció una discrepancia importante.

El repositorio `main` de GitHub termina actualmente en la serie `v1.0.20-rc13` y el último commit verificable es:

```text
32a79d2de091af66af93c7b59ad2216f56f95e4c
```

El historial de GitHub contiene la evolución `rc1 → rc13`.

Sin embargo, la IA del preview informó un estado:

```text
v1.0.20-rc-final
```

y el usuario observó en el preview:

```text
Sistema local · Sin dependencia de Internet · v0.6.0
```

contra:

```text
Sistema local · Sin dependencia de Internet · v1.0.20-rc-final
```

Eso indica que existen cambios locales/preview que no deben asumirse como ya incorporados a `main`.

### Regla

Antes de decir "esto ya está implementado":

1. comprobar GitHub;
2. comprobar el commit local;
3. comparar;
4. identificar si el cambio está:
   - en GitHub,
   - solo en preview,
   - parcialmente aplicado.

Nunca mezclar esos tres estados.

---

# 2. ESTADO ACTUAL DEL BACKEND

La base backend es considerablemente más madura que el frontend y no debe reescribirse durante la siguiente etapa.

La evolución de GitHub muestra trabajo consolidado en:

- autenticación y `authVersion`;
- realtime con token de 5 partes;
- `InventoryService`;
- `TableService`;
- `MoneyService`;
- `ProductAreaResolver`;
- concurrencia;
- SQLite real en integración;
- seguridad;
- PWA;
- backups;
- CI;
- lint;
- TypeScript;
- tests unitarios/integración;
- build.

### Decisión

Durante las primeras iteraciones frontend:

**BACKEND = CONGELADO**

Salvo:

- bugs reales que bloqueen frontend;
- API ausente imprescindible;
- contrato incorrecto demostrado por evidencia;
- problema de seguridad;
- problema de consistencia transaccional.

---

# 3. HALLAZGOS VERIFICADOS DEL REPOSITORIO

## 3.1 Inconsistencia de versiones

El historial de GitHub llega a `v1.0.20-rc13`, pero `package.json` de `main` todavía declara:

```json
"version": "1.0.20-rc2"
```

Esto es un problema de higiene del repositorio y puede contribuir a errores de UI, especialmente si alguna pantalla obtiene la versión desde una fuente diferente.

### Acción

Crear una única fuente de verdad de versión:

```text
package.json
       ↓
version resolver
       ↓
frontend
service worker
README
CHANGELOG
manifest/documentación
```

No mantener versiones escritas a mano en múltiples páginas.

---

## 3.2 BUG activo desactualizado

`docs/BUG_REGISTER.md` todavía declara un `BUG-001` de CI como P0 activo/en investigación, aunque el historial posterior contiene correcciones de CI hasta rc13.

### Acción

Auditar todo el BUG_REGISTER y marcar:

- resuelto,
- reproducible,
- obsoleto,
- pendiente,
- superseded.

Nunca dejar un P0 histórico como activo si ya está resuelto.

---

## 3.3 Service Worker

El Service Worker contiene Background Sync para POST/PUT/DELETE de negocio.

En el historial de GitHub ya fue corregido un bug donde `/api/auth/*` era interceptado y devolvía:

```text
offline-queued
```

Sin embargo, el usuario reportó que en el preview actual también aparecen:

```text
offline-queued
```

al:

- crear pedidos,
- realizar transferencias,
- crear nuevos registros.

### Conclusión

No asumir que el bug del login era el único problema del sistema offline.

La cola debe auditarse como un subsistema completo.

---

## 3.4 `offline-queued` debe ser tratado como riesgo P0

El problema puede indicar:

```text
Service Worker
       ↓
intercepta mutación
       ↓
devuelve 202 offline-queued
       ↓
UI interpreta respuesta como operación pendiente
```

Eso puede afectar un POS de forma seria.

Operaciones como:

- pago,
- inventario,
- transferencia,
- cancelación,
- modificación de pedido

no pueden ser reenviadas indiscriminadamente.

---

# 4. BUG P0-01 — OFFLINE-QUEUED

## Síntoma

En preview, al ejecutar operaciones reales aparece:

```text
offline-queued
```

incluso con servidor local disponible.

## Objetivo

Determinar si:

1. el Service Worker intercepta la petición;
2. el navegador cree estar offline;
3. el servidor LAN no es alcanzable;
4. la cola devuelve 202 aunque exista conectividad;
5. el cliente interpreta incorrectamente un estado local;
6. existe una petición duplicada;
7. el endpoint devuelve `offline-queued` por lógica interna;
8. existe un worker antiguo activo en el navegador.

## Investigación

Buscar:

```text
offline-queued
Background Sync
serviceWorker
registration.sync
navigator.onLine
IndexedDB
pending-requests
enqueueRequest
flushQueue
handleBackgroundSyncRequest
```

### Pruebas

```text
ONLINE + LAN
ONLINE + Internet OFF
LAN SERVER DOWN
LAN SERVER RESTORED
SERVICE WORKER VIEJO
SERVICE WORKER NUEVO
RECARGA
PWA INSTALADA
NAVEGADOR NUEVO
```

## Política recomendada

No todas las mutaciones deben entrar en Background Sync.

Clasificar:

| Operación | Cola offline |
|---|---|
| Login | NO |
| Logout | NO |
| Obtener datos | NO |
| Pago | NO, salvo diseño explícito con idempotencia/reconciliación |
| Transferencia inventario | NO por defecto |
| Cierre de caja | NO por defecto |
| Cancelación | NO por defecto |
| Crear pedido | Solo si existe estrategia idempotente y reconciliación |
| Ediciones no críticas | Evaluar individualmente |

### Criterio

Un fallo de conexión debe mostrar:

```text
Servidor local no disponible
```

no:

```text
offline-queued
```

si la operación no está diseñada para ser encolada.

---

# 5. BUG P0-02 — HYDRATION MISMATCH

## Síntoma observado

React/Next.js reporta:

```text
Hydration failed because the server rendered text didn't match the client.
```

con:

```text
v0.6.0
```

vs

```text
v1.0.20-rc-final
```

## Causa probable

Fuentes distintas para la versión o renderización de un valor dinámico.

## Investigación

Buscar:

```text
v0.6.0
version
NEXT_PUBLIC_
package.json
Date.now()
Math.random()
new Date()
toLocaleString()
navigator
window
document
localStorage
sessionStorage
navigator.onLine
```

### Prohibido como solución

```tsx
suppressHydrationWarning
```

sin explicar y corregir la causa.

### Solución arquitectónica

Crear:

```text
src/lib/app-version.ts
```

o equivalente.

Debe existir una sola fuente de verdad.

---

# 6. BUG P0-03 — OPERACIONES FINANCIERAS SIN IDEMPOTENCIA EN FRONTEND

La pantalla de detalle de pedido realiza el pago desde frontend.

El backend dispone de idempotencia para pagos.

El frontend debe asegurarse de generar y mantener una `idempotencyKey` por intento lógico de pago.

## Objetivo

Doble click:

```text
Cobrar
Cobrar
```

debe producir:

```text
1 operación lógica
```

Reintento por timeout:

```text
request
↓
timeout
↓
retry
```

debe reutilizar la misma clave cuando se trate del mismo intento lógico.

No generar una clave nueva para cada retry automático.

---

# 7. BUG P0-04 — DETERMINACIÓN CORRECTA DE CONECTIVIDAD

No usar únicamente:

```text
navigator.onLine
```

para decidir si el sistema SoftLBA está disponible.

El sistema trabaja dentro de una LAN.

Necesitamos distinguir:

```text
ONLINE
LOCAL_SERVER_UNREACHABLE
RECONNECTING
LOCAL_SERVER_AVAILABLE
REALTIME_DISCONNECTED
```

El usuario puede estar sin Internet y aún tener SoftLBA perfectamente operativo.

---

# 8. AUDITORÍA FRONTEND — ARQUITECTURA ACTUAL

La estructura actual incluye:

```text
src/app
src/components
src/hooks
src/lib
src/middleware.ts
public
```

y áreas como:

```text
admin
mesero
cocina
pizzeria
login
perfil
offline
ayuda
```

Además existen componentes especializados para:

```text
admin
audit
kitchen
layout
ui
loading
service worker
theme
```

Esta base debe conservarse.

## No empezar desde cero todavía

La estrategia preferida es:

```text
frontend actual
     ↓
auditoría
     ↓
separar lógica de negocio / presentación
     ↓
reutilizar componentes buenos
     ↓
reemplazar pantallas problemáticas
```

Solo reescribir una pantalla completa si:

- está demasiado acoplada;
- tiene bugs estructurales;
- no permite responsive correcto;
- impide pruebas E2E;
- mezcla demasiadas responsabilidades.

---

# 9. PRINCIPIO DE DISEÑO

SoftLBA debe sentirse como:

```text
UNA SOLA APLICACIÓN
```

No como:

```text
backend
+
panel web
+
PWA
+
KDS
+
POS
```

separados.

Flujo deseado:

```text
MESERO
  ↓
PEDIDO
  ↓
BACKEND
  ↓
RESUELVE ÁREAS
  ├── COCINA
  ├── PIZZERÍA
  └── DIRECTO/SALÓN
  ↓
INVENTARIO
  ↓
REALTIME
  ↓
COBRO
  ↓
CAJA/FINANZAS
  ↓
CIERRE
```

La interfaz debe representar ese flujo sin obligar al trabajador a conocer la arquitectura interna.

---

# 10. REDISEÑO DEL POS — MOBILE FIRST

## Prioridad de dispositivos

```text
1. Teléfono
2. Tablet
3. Desktop
```

No hacer:

```text
desktop
↓
encoger para móvil
```

Hacer:

```text
mobile
↓
tablet
↓
desktop enhancement
```

---

# 11. OBJETIVO VISUAL DEL POS

Inspiración conceptual:

- Axis POS;
- POS modernos;
- interfaces táctiles;
- KDS profesionales.

No copiar diseño propietario.

## Características deseadas

- gran área táctil;
- productos con tarjetas claras;
- categorías accesibles;
- búsqueda inmediata;
- carrito persistente;
- acciones primarias siempre accesibles;
- estado del pedido visible;
- navegación de pocos pasos;
- jerarquía visual fuerte;
- feedback inmediato;
- animaciones suaves;
- cero elementos flotando encima de botones.

---

# 12. POS MOBILE LAYOUT

Conceptualmente:

```text
┌──────────────────────────────┐
│ Mesa / Cliente / Turno       │
├──────────────────────────────┤
│ Buscar                      🔎│
├──────────────────────────────┤
│ Bebidas Café Pizzas ...      │
├──────────────────────────────┤
│                              │
│ Productos                    │
│                              │
│ ┌────────┐ ┌────────┐        │
│ │ Coca   │ │ Agua   │        │
│ │ $200   │ │ $150   │        │
│ │   +    │ │   +    │        │
│ └────────┘ └────────┘        │
│                              │
├──────────────────────────────┤
│ 🛒 4 artículos       $1,200  │
│ [Ver pedido]                 │
└──────────────────────────────┘
```

En móvil el carrito puede ser:

```text
Bottom Sheet
```

o panel deslizante.

---

# 13. PROBLEMA DE LISTAS GRANDES

El frontend actual puede crecer demasiado verticalmente cuando hay muchos productos/items.

Debe solucionarse mediante una combinación de:

- contenedores con scroll;
- sticky headers;
- sticky action bar;
- grids adaptativos;
- virtualización cuando sea necesaria;
- bottom sheets;
- paginación/infinite scroll cuando corresponda;
- límite visual de altura para paneles.

## Regla

Nunca permitir:

```text
lista gigante
↓
acción primaria desaparece
```

Ejemplo:

```text
[Enviar pedido]
```

debe seguir siendo accesible aunque haya 100 items.

---

# 14. NUEVO PEDIDO

Debe separar mentalmente:

```text
CONTEXTO
MESA / CLIENTE
```

```text
SELECCIÓN
CATEGORÍAS / PRODUCTOS
```

```text
PEDIDO
CARRITO
```

```text
ACCIÓN
GUARDAR / ENVIAR
```

No convertir todo en una única pantalla interminable.

---

# 15. CARRITO

Debe soportar cómodamente:

- cantidad;
- eliminar;
- nota;
- precio;
- subtotal;
- descuento;
- total;
- estado;
- área de producción cuando sea útil.

En móvil:

```text
+
-
```

debe ser grande y táctil.

---

# 16. PEDIDOS DEL MESERO

Diseño tipo centro operacional.

Cada pedido:

```text
#1044
Mesa 5
13:42
$ 1,850 CUP

🟡 En preparación
🍳 2 Cocina
🍕 1 Pizzería
🥤 1 Directo
```

Acciones:

- abrir;
- continuar;
- cobrar;
- cancelar;
- ver producción.

---

# 17. KDS COCINA

La pantalla de cocina debe funcionar sin teclado/mouse.

Tarjeta:

```text
PEDIDO #1044
Mesa 5
Mesero: Juan
Hora: 13:42

2 × Hamburguesa
1 × Papas

Nota:
Sin cebolla

[PREPARAR]
```

Estados visuales muy claros.

---

# 18. KDS PIZZERÍA

Mismo principio, pero aislado:

```text
PIZZERÍA
```

Nunca mostrar o permitir modificar items que no pertenecen al área.

---

# 19. PRODUCTOS DIRECTOS

Mantener la lógica de backend:

```text
DIRECTO
```

no debe entrar artificialmente en producción.

Ejemplo:

```text
Coca-Cola
Agua
Café servido
```

Debe representar el estado real del backend:

```text
DESPACHADO
→
SERVIDO
```

cuando corresponda.

---

# 20. REALTIME FRONTEND

El frontend debe utilizar el realtime existente correctamente.

Debe haber:

```text
un solo socket por panel/sesión
```

Estados:

```text
CONNECTING
CONNECTED
DISCONNECTED
RECONNECTING
AUTH_FAILED
```

UI discreta:

```text
● Conectado
```

```text
↻ Reconectando…
```

No saturar al usuario.

## Limpieza obligatoria

Cada listener creado con:

```text
socket.on(...)
```

debe poder eliminarse o estar centralizado.

Probar:

```text
mount
unmount
mount
```

sin duplicar eventos.

---

# 21. ERROR BOUNDARIES

Los `loading.tsx`/`error.tsx` son útiles.

Pero:

```text
Error inesperado
```

no puede ser la solución final a un bug.

En desarrollo debe conservarse evidencia suficiente.

En producción:

```text
No pudimos cargar esta sección.
Reintentar
Código: ...
```

---

# 22. SISTEMA DE DISEÑO

Crear/ordenar componentes reutilizables:

```text
Button
IconButton
Input
Select
Dialog
Sheet
Card
Badge
StatusBadge
Toast
DataTable
EmptyState
LoadingState
ErrorState
ConfirmDialog
ProductCard
OrderCard
Cart
OrderItem
```

Cada componente debe contemplar:

- móvil;
- tablet;
- desktop;
- dark mode;
- disabled;
- loading;
- focus;
- keyboard;
- touch;
- accessibility.

---

# 23. TOKENS VISUALES

Centralizar:

```text
colors
spacing
radii
shadows
typography
breakpoints
z-index
```

No colocar valores visuales arbitrarios por toda la aplicación.

---

# 24. ANIMACIONES

Usar Framer Motion de forma selectiva.

Sí:

- entrada de tarjetas;
- modal;
- bottom sheet;
- cambios de estado;
- feedback corto.

No:

- animaciones constantes;
- elementos rebotando;
- transiciones largas;
- efectos que impidan pulsar rápido.

El POS debe sentirse:

```text
INSTANTÁNEO
```

---

# 25. AYUDA AISLADA POR ÁREA

La ayuda no debe ser un bloque único para todos.

## Modelo

```text
ADMIN
  ↓
Admin Help

MESERO
  ↓
Waiter Help

COCINA
  ↓
Kitchen Help

PIZZERÍA
  ↓
Pizzeria Help
```

### Seguridad

Backend debe validar el acceso.

Frontend debe mostrar solamente lo correspondiente al rol/área.

Ejemplo:

```text
COCINA
```

no puede abrir:

```text
/admin/ayuda
```

cambiando la URL.

---

# 26. API Y AYUDA

Si para ayuda se necesita un endpoint:

```text
GET /api/help?area=...
```

el backend debe ignorar un `area` no autorizado enviado por cliente y derivarlo del usuario autenticado.

No confiar en:

```text
?area=ADMIN
```

desde navegador.

---

# 27. IMPRESIÓN TÉRMICA — ROADMAP FUTURO

No implementar inmediatamente.

Primero documentar.

Crear:

```text
docs/PRINTING_ARCHITECTURE.md
```

## Modelo

```text
AreaConfig
    ↓
outputMode
```

Valores:

```text
DISPLAY
PRINTER
DISPLAY_AND_PRINTER
AUTO
```

---

# 28. PRINTER SERVICE FUTURO

Crear arquitectura para algo equivalente a:

```text
PrintService
├── printKitchenOrder()
├── printPizzeriaOrder()
├── printReceipt()
├── testPrinter()
└── getPrinterStatus()
```

No acoplar pedidos a ESC/POS directamente.

---

# 29. CONFIGURACIÓN DE IMPRESORAS

Administración debe poder configurar:

```text
Nombre
Área
Modo
IP
Puerto
Protocolo
Ancho papel
Modelo
Activo
Copias
Encabezado
Pie
```

---

# 30. FALLBACK KDS → PRINTER

Más adelante:

```text
Pedido
 ↓
AreaConfig
 ↓
DISPLAY
 ↓
KDS heartbeat
 ↓
KDS OK → pantalla
KDS FAIL → printer
```

o:

```text
DISPLAY_AND_PRINTER
```

Para evitar doble impresión, utilizar:

```text
printJobId
```

y estado persistente:

```text
PENDING
SENT
PRINTED
FAILED
```

La lógica debe ser idempotente.

---

# 31. DISPOSITIVOS POS CON IMPRESORA INTEGRADA

Plan futuro.

No asumir que el navegador puede usar directamente:

- USB;
- Bluetooth;
- impresora integrada.

Arquitectura candidata:

```text
PWA / WebView
      ↓
Native Bridge
      ↓
ESC/POS
      ↓
Integrated Printer
```

Alternativa:

```text
PWA
 ↓
Local Print Agent
 ↓
Printer
```

Debe analizarse por plataforma.

---

# 32. WINDOWS

Actualmente `deploy/` contiene servicios `systemd`, por lo que la instalación Linux está más preparada que Windows.

Objetivo:

```text
deploy/linux
deploy/windows
```

Linux:

```text
systemd
```

Windows:

```text
Windows Service / NSSM / wrapper equivalente
```

Además revisar scripts shell como:

```text
cp
tee
pipes
```

para no depender de Bash.

---

# 33. E2E FRONTEND

Crear una suite real.

## Suites

```text
auth.spec.ts
pos.spec.ts
orders.spec.ts
kitchen.spec.ts
pizzeria.spec.ts
payments.spec.ts
inventory.spec.ts
admin.spec.ts
realtime.spec.ts
offline.spec.ts
responsive.spec.ts
```

---

# 34. FLUJOS E2E CRÍTICOS

## Mesero

```text
login
→ seleccionar mesa
→ crear pedido
→ añadir producto
→ editar cantidad
→ enviar
→ comprobar estado
```

## Cocina

```text
login
→ recibir pedido
→ preparar
→ listo
```

## Pizzería

igual.

## Directo

```text
producto DIRECTO
→ pedido
→ despacho
→ servido
```

## Pago

```text
pedido
→ cobrar
→ retry
→ idempotencia
→ no duplicar
```

---

# 35. E2E DE MULTIÁREA

Pedido:

```text
Pizza       → PIZZERIA
Hamburguesa → COCINA
Refresco    → DIRECTO
```

Verificar:

- cada área ve solo sus items;
- cambios aislados;
- estado general correcto;
- realtime correcto.

---

# 36. LISTAS GRANDES

Tests:

```text
10 productos
50 productos
100 productos
500 productos
```

y:

```text
10 pedidos
50 pedidos
100 pedidos
```

Comprobar:

- scroll;
- rendimiento;
- sticky actions;
- no overflow accidental;
- memoria;
- renderizado.

---

# 37. RESPONSIVE

Breakpoints de prueba:

```text
320
360
375
390
412
430
768
820
1024
1280
1920
```

Dispositivos:

- teléfono vertical;
- teléfono horizontal;
- tablet vertical;
- tablet horizontal;
- desktop.

---

# 38. VISUAL REGRESSION

Capturas:

```text
login
dashboard
nuevo pedido
carrito
mis pedidos
cocina
pizzeria
inventario
caja
admin
ayuda
```

Comparar al menos:

```text
mobile
tablet
desktop
```

---

# 39. UX DE OPERACIÓN RÁPIDA

Medir mentalmente:

```text
crear pedido
```

¿Cuántos toques?

Objetivo:

```text
mínimos pasos posibles
```

No sacrificar validaciones importantes.

---

# 40. ESTADOS UI OBLIGATORIOS

Cada pantalla debe tener:

```text
LOADING
EMPTY
SUCCESS
ERROR
OFFLINE
RECONNECTING
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
```

---

# 41. TIPADO FRONTEND

Auditar:

```text
any
as any
!
eslint-disable
ts-ignore
unknown
casts
```

No hay que llegar a cero inmediatamente, pero toda excepción debe tener justificación.

Crear tipos compartidos donde tenga sentido.

---

# 42. CONTRATO API

Crear:

```text
docs/FRONTEND_API_CONTRACT.md
```

Cada endpoint documentar:

```text
path
method
auth
permission
request
response
errors
idempotency
realtime side effects
```

Si falta una API:

```text
documentar primero
```

y después crearla con test.

---

# 43. DOCUMENTACIÓN POR MÓDULO

Crear pequeños README o `.md` en módulos importantes.

Ejemplo:

```text
src/app/admin/README.md
src/app/mesero/README.md
src/app/cocina/README.md
src/app/pizzeria/README.md
src/components/README.md
src/hooks/README.md
src/lib/README.md
tests/README.md
```

Cada uno:

```text
OBJETIVO
ESTRUCTURA
DEPENDENCIAS
ESTADO
BUGS CONOCIDOS
PENDIENTES
TESTS
NO ROMPER
```

No llenar código con comentarios redundantes.

---

# 44. REGISTRO DE BUGS FRONTEND

Crear:

```text
docs/FRONTEND_BUG_REGISTER.md
```

Formato:

| ID | Severidad | Módulo | Síntoma | Causa | Fix | Test | Estado | Versión |
|---|---|---|---|---|---|---|---|---|

IDs:

```text
FE-001
FE-002
...
```

---

# 45. PLAN DE FASES

## FRONTEND-01
Estabilidad crítica.

Corregir:

- offline-queued;
- hydration;
- version source;
- idempotencia frontend de pago;
- conectividad LAN.

### Salida

- 0 hydration errors;
- 0 offline-queued inesperados;
- tests;
- CI verde.

---

## FRONTEND-02
Auditoría completa.

Crear:

- FRONTEND_AUDIT.md;
- BUG_REGISTER;
- API_CONTRACT;
- module docs.

---

## FRONTEND-03
Design System.

Componentes + tokens.

---

## FRONTEND-04
Mobile shell.

Header/nav/sidebar/sheets.

---

## FRONTEND-05
POS Mesero.

---

## FRONTEND-06
Pedidos.

---

## FRONTEND-07
KDS Cocina.

---

## FRONTEND-08
KDS Pizzería.

---

## FRONTEND-09
Área Directo.

---

## FRONTEND-10
Admin UX.

---

## FRONTEND-11
Ayuda por área.

---

## FRONTEND-12
Realtime UX.

---

## FRONTEND-13
E2E.

---

## FRONTEND-14
Visual regression.

---

## FRONTEND-15
Performance.

---

## FRONTEND-16
Windows/Linux.

---

## FRONTEND-17
Printing architecture.

---

## FRONTEND-18
Final production audit.

---

# 46. ITERACIÓN OBLIGATORIA

Cada iteración:

```text
1. checkout main
2. leer este documento
3. seleccionar UNA fase
4. inspeccionar archivos
5. modificar solo lo necesario
6. typecheck
7. lint
8. unit tests
9. integration
10. E2E
11. build
12. preview
13. prueba visual
14. actualizar docs
15. commit
16. push
17. verificar GitHub Actions
18. registrar resultado
19. siguiente fase
```

---

# 47. PROHIBICIONES

No:

- eliminar tests para hacer verde CI;
- aceptar 200/400/409 indiscriminadamente;
- crear `any` para silenciar tipos;
- usar `suppressHydrationWarning` como parche;
- esconder errores con `error.tsx`;
- marcar tareas como completadas sin evidencia;
- reescribir backend sin necesidad;
- crear una cola offline universal;
- meter llamadas directas a Prisma en componentes frontend;
- duplicar lógica de negocio en frontend.

---

# 48. CRITERIOS DE ACEPTACIÓN

## Estabilidad

```text
TypeScript = 0
Lint = 0
Unit = 0 failed
Integration = 0 failed
E2E crítico = 0 failed
Build = SUCCESS
CI = GREEN
```

## UI

```text
sin hydration
sin overflow
sin botones tapados
sin scroll accidental
touch targets adecuados
loading/error/empty correctos
```

## POS

```text
rápido
táctil
mobile-first
tablet friendly
desktop correcto
```

## Seguridad

```text
backend authorization
frontend guard
help por área
sin IDOR
```

---

# 49. DEFINICIÓN DE PRODUCCIÓN

No publicar `v1.0.20` mientras exista:

- P0;
- P1;
- hydration error;
- offline-queued inesperado;
- E2E crítico fallando;
- CI rojo;
- documentación contradictoria;
- versión inconsistente.

---

# 50. RESULTADO FINAL ESPERADO

SoftLBA debe terminar siendo:

```text
POS profesional
+
mobile-first
+
tablet friendly
+
PWA
+
LAN-first
+
offline controlado
+
realtime
+
inventario
+
multiárea
+
KDS
+
futuro printing
+
Windows
+
Linux
```

La interfaz debe sentirse:

```text
rápida
clara
moderna
profesional
agradable
```

pero el criterio principal seguirá siendo:

```text
NO ROMPER EL NEGOCIO
```

---

# 51. PRIMERA TAREA OBLIGATORIA

No rediseñar todavía.

Primero ejecutar:

## FRONTEND-01

### P0-01
`offline-queued`

### P0-02
hydration/version mismatch

### P0-03
idempotencia frontend de pago

### P0-04
conectividad LAN vs Internet

### Documentación

Crear:

```text
docs/FRONTEND_MASTER_PLAN.md
docs/FRONTEND_AUDIT.md
docs/FRONTEND_BUG_REGISTER.md
docs/FRONTEND_API_CONTRACT.md
docs/PRINTING_ARCHITECTURE.md
```

y READMEs de módulos principales.

---

# 52. INFORME FINAL DE CADA ITERACIÓN

Siempre entregar:

```text
VERSION:
COMMIT:

FASE:
ESTADO:

BUGS ENCONTRADOS:
BUGS CORREGIDOS:

FILES MODIFIED:
FILES ADDED:
FILES REMOVED:

TYPECHECK:
LINT:
UNIT:
INTEGRATION:
E2E:
BUILD:
CI:

PREVIEW:
PASS / FAIL

VISUAL:
PASS / FAIL

DOCUMENTATION:
UPDATED / NOT UPDATED

RISKS:
...

NEXT PHASE:
...
```

No usar "todo bien" como respuesta.

Dar números y evidencia.

---

# 53. DECISIÓN SOBRE REESCRIBIR FRONTEND

Regla:

## Mantener y mejorar

cuando:

- la arquitectura es aprovechable;
- el bug es local;
- la UX puede corregirse con componentes;
- la lógica ya está validada.

## Reescribir una pantalla

cuando:

- mezcla demasiadas responsabilidades;
- no es responsive;
- produce bugs repetidos;
- impide E2E;
- tiene demasiada lógica visual en una sola página.

## Reescribir TODO el frontend

solo si una auditoría demuestra que:

- la base no es mantenible;
- existe acoplamiento extremo;
- la lógica de negocio está duplicada;
- el sistema de estado está roto;
- las pruebas no pueden hacerse de forma fiable.

La preferencia actual es:

**NO reescribir todo.**

Primero transformar el frontend existente de manera progresiva.

---

# 54. FINAL

El documento debe mantenerse vivo.

Cuando una fase se completa:

```text
[ ] → [x]
```

y registrar:

```text
versión
commit
tests
fecha
```

Cuando aparezca un bug nuevo:

```text
BUG_REGISTER
```

Cuando se necesite una API nueva:

```text
API_CONTRACT
```

Cuando se diseñe impresión:

```text
PRINTING_ARCHITECTURE
```

Cuando cambie la arquitectura:

```text
docs/architecture
```

De esta forma el proyecto puede seguir creciendo durante meses sin que la IA pierda el contexto.
