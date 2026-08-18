// GET /api/mesero/orders - Lista pedidos del mesero actual (o todos si ADMIN)
// POST /api/mesero/orders - Crear nuevo pedido
// FASE 3: logger estructurado con redacción.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { decrementDirectoStock } from '@/lib/directo-stock'
import { recalculateOrderStatus } from '@/lib/order-state-machine'
import { sumConvertedToCup } from '@/lib/currency'
import { emitOrderNew } from '@/lib/realtime-emitter'
import { createPrintJobsForOrder } from '@/lib/print/print-service'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Estados considerados "activos" en el dashboard del mesero
const ACTIVE_STATUS = ['CREADO', 'ENVIADO', 'EN_PREPARACION', 'LISTO', 'SERVIDO']

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'MESERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const includeArchived = searchParams.get('archived') === 'true'

    // Mesero solo ve sus pedidos. Admin ve todos.
    const where: any = {}
    if (user.role !== 'ADMIN') {
      where.userId = user.id
    }

    if (status) {
      where.status = status
    } else if (!includeArchived) {
      where.status = { in: ACTIVE_STATUS }
    }

    const orders = await db.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        area: { select: { id: true, name: true, code: true } },
        table: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, code: true, price: true } },
          },
        },
        payments: { select: { id: true, method: true, amount: true, currency: true, createdAt: true } },
      },
      take: 200,
    })

    // Calcular total pagado por pedido
    // v1.0-RC1-bloque2-3 (item 22): en CUP usando convertedAmount snapshot.
    const config = await db.restaurantConfig.findFirst({ where: { id: 'config-1' } })
    const usdToCupRate = config?.usdToCup || 320
    const items = orders.map((o) => {
      const paidTotal = sumConvertedToCup(o.payments, usdToCupRate)
      return {
        id: o.id,
        number: o.number,
        status: o.status,
        paymentStatus: o.paymentStatus,
        customerName: o.customerName,
        subtotal: o.subtotal,
        discountPct: o.discountPct,
        discountAmount: o.discountAmount,
        total: o.total,
        notes: o.notes,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        closedAt: o.closedAt,
        area: o.area,
        table: o.table,
        itemsCount: o.items.length,
        items: o.items,
        payments: o.payments,
        paidTotal,
        pendingTotal: Math.max(0, o.total - paidTotal),
      }
    })

    return NextResponse.json({ ok: true, items })
  } catch (e: any) {
    logger.error('GET /api/mesero/orders', { err: (e as Error)?.message }, 'api')
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().min(0.01).max(9999),
  notes: z.string().max(300).optional().or(z.literal('')),
  serveMode: z.enum(['now', 'with_order']).optional(), // Para productos directos
})

const CreateOrderSchema = z.object({
  areaId: z.string().min(1),
  tableId: z.string().min(1).optional().or(z.literal('')),
  customerName: z.string().max(120).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  items: z.array(ItemSchema).min(1, 'Debes agregar al menos un producto'),
  sendToKitchen: z.boolean().default(true),
  // FASE 17-18: idempotencyKey para prevenir duplicados por doble click
  // o reintento de red. El frontend genera un UUID por intento y lo reenvía
  // en reintentos. Si el backend ya recibió esa key, devuelve el Order
  // existente sin crear uno nuevo.
  idempotencyKey: z.string().min(8).max(120).optional(),
})

// Verificar permiso de descuento
function checkDiscountPermission(role: string, discountPct: number): boolean {
  if (discountPct === 0) return true
  // Solo ADMIN puede aplicar descuentos > 0
  // MESERO y MESERO_PRO no pueden sin permiso explícito
  return role === 'ADMIN'
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'MESERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = CreateOrderSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    }
    const d = parsed.data

    // FASE 17-18: Idempotencia — si ya existe un Order con esta idempotencyKey,
    // devolverlo sin crear uno nuevo. Esto protege contra doble click y reintentos.
    if (d.idempotencyKey) {
      const existing = await db.order.findUnique({
        where: { idempotencyKey: d.idempotencyKey },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          areaId: true,
          tableId: true,
          userId: true,
        },
      })
      if (existing) {
        // Solo el mismo usuario puede reclamar su propio pedido idempotente.
        if (existing.userId !== user.id) {
          return NextResponse.json(
            { ok: false, error: 'idempotencyKey en uso por otro usuario' },
            { status: 409 },
          )
        }
        logger.info('POST /api/mesero/orders — idempotency hit', { orderId: existing.id, idempotencyKey: d.idempotencyKey }, 'orders')
        return NextResponse.json({
          ok: true,
          item: existing,
          idempotent: true,
          message: 'Pedido ya creado (idempotente)',
        })
      }
    }

    // Verificar permiso de descuento (solo ADMIN puede aplicar descuentos > 0)
    if (!checkDiscountPermission(user.role, d.discountPct)) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para aplicar descuentos' }, { status: 403 })
    }

    // Validar área
    const area = await db.area.findUnique({ where: { id: d.areaId } })
    if (!area || !area.isActive) {
      return NextResponse.json({ ok: false, error: 'Área inválida o inactiva' }, { status: 400 })
    }
    // Restringir áreas permitidas: SALON y PIZZERIA principalmente.
    const ALLOWED_AREA_CODES = ['SALON', 'PIZZERIA']
    if (!ALLOWED_AREA_CODES.includes(area.code) && user.role !== 'ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'No tienes permiso para crear pedidos en esta área' },
        { status: 403 },
      )
    }

    // Validar mesa (si viene). v1.0-RC1-bloque1-2 (item 13): verificar que esté LIBRE.
    let table: { id: string; areaId: string | null; name: string; status: string; isActive: boolean } | null = null
    if (d.tableId) {
      table = await db.table.findUnique({ where: { id: d.tableId } })
      if (!table || !table.isActive) {
        return NextResponse.json({ ok: false, error: 'Mesa inválida' }, { status: 400 })
      }
      if (table.areaId && table.areaId !== d.areaId) {
        return NextResponse.json(
          { ok: false, error: 'La mesa no pertenece al área seleccionada' },
          { status: 400 },
        )
      }
      // Item 13: prevenir doble asignación
      if (table.status === 'OCUPADA' && user.role !== 'ADMIN') {
        return NextResponse.json(
          { ok: false, error: 'Mesa ya ocupada' },
          { status: 400 },
        )
      }
    }

    // Cargar productos
    const productIds = d.items.map((i) => i.productId)
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
    })
    if (products.length !== productIds.length) {
      return NextResponse.json({ ok: false, error: 'Uno o más productos no existen' }, { status: 400 })
    }

    // Validar productos activos y disponibles
    for (const p of products) {
      if (!p.isActive || !p.isAvailable) {
        return NextResponse.json(
          { ok: false, error: `Producto "${p.name}" no disponible` },
          { status: 400 },
        )
      }
      if (p.type === 'SUBPRODUCTO') {
        return NextResponse.json(
          { ok: false, error: `Producto "${p.name}" no es vendible directamente` },
          { status: 400 },
        )
      }
    }

    // FIX 4 / item 8: Verificar stock suficiente si blockNegativeStock=true.
    // Solo aplica a productos DIRECTO (los FINALES descuentan al prepararse vía receta).
    const config = await db.restaurantConfig.findFirst({ where: { id: 'config-1' } })
    const blockNegative = config?.blockNegativeStock ?? true
    if (blockNegative) {
      // Cargar inventarios de área (con migración automática implícita vía ensureAreaInventory
      // al momento del decremento; aquí solo validamos para dar error temprano).
      const directItems = d.items.filter((i) => {
        const p = products.find((pp) => pp.id === i.productId)!
        return p.type === 'DIRECTO'
      })
      if (directItems.length > 0) {
        const areaInvRows = await db.areaInventory.findMany({
          where: {
            areaId: d.areaId,
            productId: { in: directItems.map((i) => i.productId) },
          },
        })
        const generalInvRows = await db.inventoryItem.findMany({
          where: { productId: { in: directItems.map((i) => i.productId) } },
        })
        // Sumar cantidades por producto (puede haber dos items del mismo producto)
        const neededByProduct = new Map<string, number>()
        for (const i of directItems) {
          neededByProduct.set(i.productId, (neededByProduct.get(i.productId) || 0) + i.quantity)
        }
        for (const [pid, needed] of neededByProduct.entries()) {
          const p = products.find((pp) => pp.id === pid)!
          const areaInv = areaInvRows.find((r) => r.productId === pid)
          const genInv = generalInvRows.find((r) => r.productId === pid)
          // Si existe en el área, se descuenta del área; si no, del general.
          const available = areaInv ? areaInv.stock : (genInv?.stock ?? 0)
          if (available < needed) {
            return NextResponse.json(
              { ok: false, error: `Stock insuficiente de "${p.name}" (disponible: ${available}, requerido: ${needed})` },
              { status: 400 },
            )
          }
        }
      }
    }

    // v1.0-RC1-bloque1-2 (item 14): buscar turno abierto del usuario para
    // asociarlo al pedido. No es obligatorio: si no hay turno, shiftId=null.
    const openShift = await db.workShift.findFirst({
      where: { userId: user.id, status: 'OPEN' },
      orderBy: { startTime: 'desc' },
      select: { id: true },
    })

    // Calcular subtotal y asignar área de elaboración a cada item.
    // v1.0-RC1-bloque1-2 (item 3):
    //   - DIRECTO: targetAreaId = área del pedido (SALON), porque se despacha
    //     inmediatamente desde Salón.
    //   - FINAL: targetAreaId = product.areaId (área de elaboración del producto).
    // v1.0-RC1-bloque1-2 (item 1): DIRECTO nace como SERVIDO (despachado inmediato).
    const itemLines = d.items.map((i) => {
      const p = products.find((pp) => pp.id === i.productId)!
      const lineTotal = p.price * i.quantity
      const isDirecto = p.type === 'DIRECTO'
      const targetAreaId = isDirecto ? d.areaId : (p.areaId || d.areaId)
      return {
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: p.price,
        discount: 0,
        notes: i.notes || null,
        lineTotal,
        targetAreaId,
        serveMode: i.serveMode || (isDirecto ? 'now' : 'with_order'),
        isDirecto,
      }
    })
    const subtotal = itemLines.reduce((s, i) => s + i.lineTotal, 0)
    const discountAmount = +(subtotal * (d.discountPct / 100)).toFixed(2)
    const total = +(subtotal - discountAmount).toFixed(2)

    // FIX 5: Generar número único mediante OrderSequence (transacción atómica).
    // El upsert incrementa nextNumber atómicamente; usamos nextNumber-1 como número del pedido.
    const nextNumber = await db.$transaction(async (tx) => {
      const seq = await tx.orderSequence.upsert({
        where: { id: 1 },
        update: { nextNumber: { increment: 1 } },
        create: { id: 1, nextNumber: 1001 },
      })
      return seq.nextNumber - 1
    })
    // Fallback de seguridad: si por algún motivo el número ya existe (base migrada desde
    // pedidos anteriores que usaban lastOrder+1), buscar el último + 1.
    const exists = await db.order.findUnique({ where: { number: nextNumber }, select: { id: true } })
    let finalNumber = nextNumber
    if (exists) {
      const lastOrder = await db.order.findFirst({ orderBy: { number: 'desc' }, select: { number: true } })
      finalNumber = (lastOrder?.number || 1000) + 1
    }

    // v1.0-RC1-bloque1-2 (items 1, 3, 9, 10, 11, 14):
    // Transacción principal que crea el pedido, decrementa stock de DIRECTO
    // atómicamente, marca mesa como OCUPADA, y asocia turno.
    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          number: finalNumber,
          userId: user.id,
          areaId: d.areaId,
          tableId: table?.id || null,
          customerName: d.customerName || null,
          status: d.sendToKitchen ? 'ENVIADO' : 'CREADO',
          subtotal,
          discountPct: d.discountPct,
          discountAmount,
          total,
          notes: d.notes || null,
          paymentStatus: 'PENDIENTE',
          shiftId: openShift?.id || null,
          // FASE 17-18: persistir idempotencyKey si llegó.
          idempotencyKey: d.idempotencyKey || null,
          items: {
            create: itemLines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.discount,
              notes: l.notes,
              // Item 1: DIRECTO nace SERVIDO; FINAL nace PENDIENTE.
              status: l.isDirecto ? 'SERVIDO' : 'PENDIENTE',
              targetAreaId: l.targetAreaId,
              serveMode: l.serveMode,
            })),
          },
        },
        include: {
          items: { include: { product: { select: { id: true, name: true, code: true, price: true, type: true } } } },
          area: true,
          table: true,
        },
      })

      // Item 11: marcar mesa como OCUPADA en la misma transacción.
      if (table) {
        await tx.table.update({
          where: { id: table.id },
          data: { status: 'OCUPADA' },
        })
      }

      // Items 9, 10: decrementar stock atómicamente para productos DIRECTO.
      // Para productos FINALES, no decrementar aquí (lo hace cocina al preparar, vía receta).
      for (const it of itemLines) {
        if (!it.isDirecto) continue
        const p = products.find((pp) => pp.id === it.productId)!
        const result = await decrementDirectoStock(d.areaId, p.id, it.quantity, {
          blockNegative,
          orderNumber: created.number,
          reference: created.id,
          userId: user.id,
          unit: p.unit,
          tx,
        })
        if (!result.ok) {
          // Lanzamos para revertir la transacción completa.
          throw new Error(
            `Stock insuficiente de "${p.name}": ${result.message || 'no se pudo descontar'}`,
          )
        }
      }

      return created
    })

    // Recalcular estado del pedido (item 6): si todos los items son DIRECTO y están SERVIDO,
    // el pedido podría pasar a LISTO automáticamente.
    // FASE 17-18: silenciar el .catch() que ocultaba errores — solo loguear.
    const finalStatus = await recalculateOrderStatus(order.id).catch((err) => {
      logger.warn('recalculateOrderStatus falló tras crear pedido', { err: (err as Error)?.message, orderId: order.id }, 'orders')
      return order.status
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'order',
      entityId: order.id,
      after: {
        number: order.number,
        areaId: order.areaId,
        tableId: order.tableId,
        status: order.status,
        subtotal,
        discountPct: d.discountPct,
        discountAmount,
        total,
        itemsCount: itemLines.length,
        shiftId: openShift?.id || null,
        idempotencyKey: d.idempotencyKey || null,
      },
    })

    // v1.0.17: emitir order:new DESPUÉS del DB COMMIT, desde el servidor.
    // El frontend ya NO emite eventos de negocio.
    if (d.sendToKitchen) {
      // FASE 17-18: emitir order:new fire-and-forget — no bloquea la respuesta.
      emitOrderNew({
        orderId: order.id,
        orderNumber: order.number,
        areaId: order.areaId,
        userId: user.id,
        tableId: order.tableId || undefined,
        total,
      }).catch((err) => {
        logger.warn('emitOrderNew falló (fire-and-forget)', { err: (err as Error)?.message, orderId: order.id }, 'realtime')
      })

      // v1.1.0-rc6: crear PrintJobs por área.
      // FASE 17-18: fire-and-forget — no bloquear la respuesta al cliente.
      // El worker procesará la cola (FASE 14); si el worker no está activo,
      // los PrintJobs quedan en PENDING hasta que se arranque el worker.
      createPrintJobsForOrder(order.id)
        .then((printResult) => {
          logger.info('PrintJobs creados', { created: printResult.created, skipped: printResult.skipped, orderId: order.id }, 'orders')
        })
        .catch((printErr) => {
          // La impresión NO debe bloquear el pedido. Si falla, log y continuar.
          logger.error('Error creando PrintJobs', { err: (printErr as Error)?.message, orderId: order.id }, 'orders')
        })
    }

    return NextResponse.json({
      ok: true,
      item: { ...order, status: finalStatus as any },
      wsPayload: {
        orderId: order.id,
        orderNumber: order.number,
        userId: user.id,
        areaId: order.areaId,
        tableId: order.tableId || undefined,
        total,
        status: order.status,
      },
    })
  } catch (e: any) {
    logger.error('POST /api/mesero/orders', { err: (e as Error)?.message, stack: (e as Error)?.stack }, 'api')
    // Errores lanzados desde dentro de la transacción: mensaje útil al cliente.
    if (e?.message?.startsWith('Stock insuficiente')) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
