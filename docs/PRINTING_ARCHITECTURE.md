# SoftLBA — Printing Architecture

**Versión:** v1.0.20-rc33
**Fecha:** 2026-08-15
**Estado:** Roadmap (no implementado todavía — este documento define la arquitectura)

---

## 1. Objetivo

SoftLBA necesita imprimir comprobantes y órdenes de cocina en impresoras
térmicas ESC/POS conectadas localmente. Este documento define la arquitectura
de impresión que se implementará en futuras versiones.

---

## 2. Modelos de conexión

### 2.1 PWA → Local Print Agent (recomendado para LAN)

```
PWA (navegador)
    ↓ HTTP POST /print
Local Print Agent (Node.js en el mismo PC que la impresora)
    ↓ ESC/POS
Impresora térmica USB/LAN
```

El Local Print Agent es un mini-servicio (puerto 3004) que recibe JSON
desde la PWA y lo traduce a comandos ESC/POS.

### 2.2 PWA → WebSocket → Print Service

```
PWA (navegador)
    ↓ WebSocket (Socket.IO)
Print Service (Node.js)
    ↓ ESC/POS
Impresora térmica
```

Ventaja: tiempo real. Desventaja: más complejo.

### 2.3 WebView + Native Bridge (futuro, app móvil)

```
PWA (WebView)
    ↓ Native Bridge
App nativa (Electron / Tauri / Capacitor)
    ↓ ESC/POS
Impresora USB/Bluetooth
```

---

## 3. AreaConfig

Cada área (COCINA, PIZZERIA, SALON) puede configurar su modo de salida:

```typescript
type OutputMode = 'DISPLAY' | 'PRINTER' | 'DISPLAY_AND_PRINTER' | 'AUTO'

interface AreaConfig {
  areaId: string
  outputMode: OutputMode
  printerId?: string  // Referencia a Printer config
}
```

### Comportamiento por modo:

| Modo | KDS | Impresora | Cuándo |
|------|-----|-----------|-------|
| `DISPLAY` | ✅ | ❌ | Solo pantalla (default) |
| `PRINTER` | ❌ | ✅ | Solo impresora |
| `DISPLAY_AND_PRINTER` | ✅ | ✅ | Ambos (con deduplicación) |
| `AUTO` | ✅ si KDS activo | ✅ si KDS caído | Fallback automático |

---

## 4. PrintService (roadmap)

```typescript
class PrintService {
  printKitchenOrder(order: Order): Promise<PrintResult>
  printPizzeriaOrder(order: Order): Promise<PrintResult>
  printReceipt(order: Order, payments: Payment[]): Promise<PrintResult>
  testPrinter(printerId: string): Promise<PrinterStatus>
  getPrinterStatus(printerId: string): Promise<PrinterStatus>
}
```

No acoplar pedidos a ESC/POS directamente. El PrintService traduce
el modelo de dominio (Order, OrderItem, Payment) a comandos ESC/POS.

---

## 5. Printer Configuration

Administración puede configurar impresoras:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| name | string | Nombre legible |
| area | string | Área asignada |
| mode | OutputMode | DISPLAY / PRINTER / DISPLAY_AND_PRINTER / AUTO |
| ip | string | IP de la impresora (LAN) |
| port | number | Puerto (default: 9100) |
| protocol | string | ESC/POS | CUPS | RAW |
| paperWidth | number | 58mm | 80mm |
| model | string | Modelo de la impresora |
| active | boolean | Activa/inactiva |
| copies | number | Número de copias |
| header | string | Encabezado del comprobante |
| footer | string | Pie del comprobante |

---

## 6. Fallback KDS → Printer

Cuando `outputMode = AUTO`:

```
Pedido nuevo
    ↓
AreaConfig.outputMode = AUTO
    ↓
Verificar KDS heartbeat
    ↓
KDS OK → pantalla (DISPLAY)
KDS FAIL → impresora (PRINTER)
```

Para evitar doble impresión (si ambos están activos), usar `printJobId`:

```typescript
interface PrintJob {
  id: string         // Único por operación
  orderId: string
  type: 'KITCHEN' | 'RECEIPT'
  status: 'PENDING' | 'SENT' | 'PRINTED' | 'FAILED'
  createdAt: Date
  printedAt?: Date
}
```

La lógica debe ser idempotente: si un `printJobId` ya está `PRINTED`,
no reimprimir.

---

## 7. Dispositivos POS con impresora integrada

No asumir que el navegador puede usar directamente USB/Bluetooth.

### Arquitectura candidata:

```
PWA (WebView en dispositivo POS)
    ↓ Native Bridge (Electron / Capacitor)
    ↓ ESC/POS
    ↓ Integrated Printer (USB)
```

### Alternativa sin app nativa:

```
PWA
    ↓ HTTP POST
Local Print Agent (servicio en localhost:3004)
    ↓ ESC/POS
Printer (USB o LAN)
```

Debe analizarse por plataforma:
- **Windows:** Local Print Agent + driver ESC/POS
- **Linux:** CUPS + filtro ESC/POS
- **Android (futuro):** Capacitor + plugin USB

---

## 8. Endpoints de API (roadmap)

| Endpoint | Method | Descripción |
|----------|--------|-------------|
| `/api/admin/printers` | GET | Listar impresoras |
| `/api/admin/printers` | POST | Crear impresora |
| `/api/admin/printers/[id]` | PATCH | Actualizar |
| `/api/admin/printers/[id]` | DELETE | Eliminar |
| `/api/admin/printers/[id]/test` | POST | Imprimir test |
| `/api/internal/print` | POST | Imprimir desde la app (interna) |

---

## 9. Implementación gradual

### Fase 1: Documentación (este archivo) ✅
### Fase 2: Schema Prisma + endpoints CRUD de impresoras
### Fase 3: PrintService con ESC/POS
### Fase 4: Local Print Agent (mini-servicio :3004)
### Fase 5: Integración con KDS (fallback AUTO)
### Fase 6: App nativa (Capacitor/Electron) para USB

---

## 10. Dependencias futuras

```json
{
  "escpos": "^3.0.0",
  "node-thermal-printer": "^4.0.0"
}
```

No instalar hasta la Fase 3.
