# Task f9 - Resumen del subagente full-stack-developer

## Módulos creados
1. **Inventario General** (`/admin/inventario-general`): gestión central del stock. APIs: lista con join product, POST movimiento (ENTRADA/SALIDA/AJUSTE/MERMA/COMPRA), GET detalle con movimientos, PATCH ajuste directo, GET movimientos paginados con filtros, POST traslado a área. Páginas: lista con dialogs de movimiento/traslado, historial de movimientos con paginación.

2. **Inventario por Áreas** (`/admin/inventario`): stock por área con filtrado por rol (ADMIN ve todas, COCINA ve COCINA+SALON, PIZZERIA ve solo PIZZERIA). APIs: lista, detalle con movimientos, ajuste PATCH, conteo físico POST, comparación teórico vs físico GET. Páginas: selector de área + tabla con ajustes y conteo físico, página de comparación con stats y diff coloreado.

3. **Recetas** (`/admin/recetas`): fórmulas de productos finales. APIs: lista con ingredientes y costo total, GET/POST crear, PATCH/DELETE por id, GET por productId. Páginas: lista con margen, nuevo con formulario de ingredientes, editar.

4. **Finanzas** (`/admin/finanzas`): dashboard con totales y gráfico recharts. APIs: resumen por rango, entries CRUD, summary por período (today/week/month/range) con chartData por día, libro-mayor por categoría. Páginas: dashboard con stat cards + bar chart, lista con filtros y paginación, nuevo movimiento.

5. **Cierre Diario** (`/admin/cierre-diario`): cierre de caja con denominaciones. APIs: lista, abrir (calcula automáticamente totales desde payments y mermas), current, detalle, PATCH, denominations POST, close POST (action=close/lock). Páginas: lista con dialog abrir, detalle con stats, denominaciones (CUP y USD), observaciones, botones cerrar/bloquear con AlertDialogs.

6. **Clientes** (`/admin/clientes`): CRUD completo. Páginas lista/nuevo/editar con búsqueda.

7. **Promociones** (`/admin/promociones`): CRUD con tipos (GENERAL/CLIENTE/PRODUCTO), descuentos por % y monto fijo, fechas de vigencia. Páginas lista (con toggle activo inline, badge "Expirada")/nuevo/editar.

8. **Respaldos** (`/admin/respaldos`): backup y restore de SQLite. APIs: lista, crear (con PRAGMA wal_checkpoint), download (Content-Disposition), restore (con auto-backup pre-restore + eliminación de WAL/SHM). Página lista con botones descargar y restaurar.

## Decisiones técnicas
- Validación con Zod en todos los POST/PATCH.
- Audit log con función audit() después de acciones exitosas.
- Verificación de rol (ADMIN/CAJERO/COCINA/PIZZERIA según módulo) en cada endpoint.
- Transacciones Prisma para operaciones que tocan múltiples tablas.
- Filtros de área por rol (no se pueden saltar vía API).
- Recálculo automático de totales al agregar denominaciones.
- Bug crítico resuelto: WAL de SQLite → al restaurar custom.db, Prisma seguía leyendo WAL con datos nuevos. Solución: `PRAGMA wal_checkpoint(FULL)` antes de copiar + unlink de custom.db-wal y custom.db-shm después de restaurar.

## Verificación
- Lint: 0 errores.
- Dev server: sin errores de compilación, todos los endpoints responden 200.
- 19 archivos API + 17 archivos de página creados.
- curl tests completos: login, GET/POST en cada endpoint, PATCH/DELETE donde aplica, restore funciona correctamente (datos vuelven al estado del backup).

## Para subagentes posteriores
- Si necesitan manipular stock de inventario desde otros módulos: usar transacciones Prisma y crear StockMovement correspondiente.
- Para finanzas automáticas (pagos, compras, mermas): crear FinanceEntry con el tipo adecuado y referencia.
- Para cierres diarios: usar el endpoint `/api/admin/cierre-diario` POST para abrir (calcula automáticamente) y `/current` para obtener el activo.
- Para listar productos por área con stock: GET `/api/admin/inventario?areaId=...`.
