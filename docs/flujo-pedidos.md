# Flujo de Pedidos - Sistema de Restaurante Cuba

## Diagrama de flujo

```
┌──────────────┐
│   Mesero     │
│   crea       │
│   pedido    │
└──────┬───────┘
       │ POST /api/mesero/orders
       ▼
┌──────────────────────────────────────┐
│  Backend valida y guarda pedido       │
│  - Genera número único                │
│  - Calcula subtotal/descuento/total  │
│  - Decrementa stock del área          │
│  - Crea items                         │
│  - Estado: ENVIADO                    │
│  - Audit log                          │
└──────┬───────────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  WebSocket: order:new       │
│  → emite a cocina/área      │
│  → emite a admin            │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Cocina recibe pedido       │
│  - Ve tarjeta con detalle   │
│  - Suena notificación       │
│  - Estado: ENVIADO         │
└──────┬──────────────────────┘
       │ Click "Empezar"
       ▼
┌─────────────────────────────┐
│  PATCH /api/cocina/orders/   │
│  [id]/status                 │
│  Estado: EN_PREPARACION     │
│  WS: order:status            │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Mesero ve actualización    │
│  en tiempo real              │
└──────────────────────────────┘

       (Cocina prepara)

┌─────────────────────────────┐
│  Click "Listo"               │
│  Estado: LISTO              │
│  WS: order:ready            │
│  → Mesero recibe sonido     │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Mesero sirve y cobra       │
│  POST /api/mesero/orders/   │
│  [id]/pay                   │
│  → Registra pago(s)         │
│  → Estado: COBRADO          │
│  → WS: payment:done         │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Pedido pasa a historial    │
│  Estado final: COBRADO      │
└──────────────────────────────┘

Cualquier momento antes de EN_PREPARACION:
       ↓
   CANCELADO (con devolución de stock)
```

## Estados de pedido

| Estado | Quién lo cambia | Color UI | Acción siguiente |
|--------|----------------|----------|------------------|
| CREADO | Mesero (guardar sin enviar) | gris | Enviar a cocina |
| ENVIADO | Mesero (enviar) | gris claro | Cocina empieza |
| EN_PREPARACION | Cocina | amarillo | Marcar listo |
| LISTO | Cocina | verde | Mesero sirve |
| SERVIDO | Mesero | púrpura | Cobrar |
| COBRADO | Mesero/Cajero | verde fuerte | Archivar |
| ARCHIVADO | Sistema (auto) | gris | - |
| CANCELADO | Mesero (con permiso) | rojo | - |

## Restricciones del mesero

- ✅ Ve solo SUS pedidos
- ✅ Solo puede crear a su nombre
- ❌ No puede editar pedidos ajenos
- ✅ Puede cancelar sus pedidos en estados CREADO/ENVIADO
- ✅ Puede cobrar si tiene permiso CAN_COBRAR

## Cobro y pagos combinados

### Métodos de pago

| Código | Nombre |
|--------|--------|
| EFECTIVO_CUP | Efectivo CUP |
| EFECTIVO_USD | Efectivo USD |
| TRANSFERENCIA_CUP | Transferencia CUP |
| TRANSFERENCIA_USD | Transferencia USD |
| ZELLE | Zelle |
| BANCARIA_USD | Bancaria USD |
| COMBINADO | Pago combinado (varios) |

### Pago combinado

Un pedido puede pagarse en varias partes:

```
Pedido total: $500 CUP
Pago 1: $300 EFECTIVO_CUP
Pago 2: $200 TRANSFERENCIA_CUP
→ paymentStatus: PAGADO cuando la suma = total
→ order.status: COBRADO
```

### Descuentos

- Descuento porcentual sobre el subtotal
- Auditado con motivo, usuario, valor original y final
- Aplica antes de impuestos

## Comprobante

- Generación on-demand desde detalle del pedido
- Botón "Imprimir" usa `window.print()`
- Contiene: logo, datos restaurante, items, totales, método de pago
- Diseño tipo recibo térmico (80mm)

## Notificaciones al mesero

| Evento | Mensaje | Acción |
|--------|---------|--------|
| order:status (EN_PREPARACION) | "Tu pedido #X está en preparación" | Solo info |
| order:ready | "Tu pedido #X está listo" | Suena + vibra |
| payment:done (a cajero) | "Pago registrado" | Info |
| stock:low (a admin) | "Stock bajo: Producto Y" | Revisar inventario |
