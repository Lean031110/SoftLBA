// GET /api/mesero/orders - Lista pedidos del mesero actual (o todos si ADMIN)
// POST /api/mesero/orders - Crear nuevo pedido
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
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
    const items = orders.map((o) => {
      const paidTotal = o.payments.reduce((s, p) => s + p.amount, 0)
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
    console.error('GET /api/mesero/orders', e)
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
  // Si true, el pedido se crea directamente como ENVIADO. Si false, como CREADO.
  sendToKitchen: z.boolean().default(true),
})

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

    // Validar mesa (si viene)
    let table: { id: string; areaId: string | null; name: string } | null = null
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

    // FIX 4: Verificar stock suficiente si blockNegativeStock=true.
    // Solo aplica a productos DIRECTO (los FINALES descuentan al prepararse vía receta).
    const config = await db.restaurantConfig.findFirst({ where: { id: 'config-1' } })
    const blockNegative = !!config?.blockNegativeStock
    if (blockNegative) {
      // Cargar inventarios (área + general) en paralelo para validar stock suficiente
      const directItems = d.items.filter((i) => {
        const p = products.find((pp) => pp.id === i.productId)!
        return p.type === 'DIRECTO'
      })
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

    // Calcular subtotal y asignar área de elaboración a cada item
    const itemLines = d.items.map((i) => {
      const p = products.find((pp) => pp.id === i.productId)!
      const lineTotal = p.price * i.quantity
      // El área de elaboración (targetAreaId) se determina así:
      // - Si el producto tiene areaId asignado, ese es el área de elaboración
      // - Si no tiene areaId (null = global), el área de elaboración es el área del pedido
      const targetAreaId = p.areaId || d.areaId
      return {
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: p.price,
        discount: 0,
        notes: i.notes || null,
        lineTotal,
        targetAreaId,
        serveMode: i.serveMode || (p.type === 'DIRECTO' ? 'now' : 'with_order'),
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

    // Crear pedido con transacción (incluye decrementar stock del área)
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
          items: {
            create: itemLines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.discount,
              notes: l.notes,
              status: 'PENDIENTE',
              targetAreaId: l.targetAreaId,
              serveMode: l.serveMode,
            })),
          },
        },
        include: {
          items: { include: { product: { select: { id: true, name: true, code: true, price: true } } } },
          area: true,
          table: true,
        },
      })

      // Decrementar stock del área correspondiente para productos DIRECTO
      // Para productos FINALES, no decrementar stock aquí (lo hace cocina al preparar, vía receta).
      for (const it of itemLines) {
        const p = products.find((pp) => pp.id === it.productId)!
        if (p.type === 'DIRECTO') {
          // Decrementar del inventario del área si existe; si no, del inventario general.
          const areaInv = await tx.areaInventory.findUnique({
            where: { areaId_productId: { areaId: d.areaId, productId: p.id } },
          })
          if (areaInv) {
            const newStock = Math.max(0, areaInv.stock - it.quantity)
            const newReserved = Math.max(0, areaInv.reserved - Math.min(areaInv.reserved, it.quantity))
            await tx.areaInventory.update({
              where: { id: areaInv.id },
              data: { stock: newStock, reserved: newReserved },
            })
            await tx.stockMovement.create({
              data: {
                type: 'SALIDA',
                productId: p.id,
                areaId: d.areaId,
                quantity: it.quantity,
                unit: p.unit,
                reason: `Pedido #${created.number}`,
                reference: created.id,
                userId: user.id,
              },
            })
          } else {
            // Intentar inventario general
            const genInv = await tx.inventoryItem.findUnique({ where: { productId: p.id } })
            if (genInv) {
              const newStock = Math.max(0, genInv.stock - it.quantity)
              const newReserved = Math.max(0, genInv.reserved - Math.min(genInv.reserved, it.quantity))
              await tx.inventoryItem.update({
                where: { id: genInv.id },
                data: { stock: newStock, reserved: newReserved },
              })
              await tx.stockMovement.create({
                data: {
                  type: 'SALIDA',
                  productId: p.id,
                  areaId: null,
                  quantity: it.quantity,
                  unit: p.unit,
                  reason: `Pedido #${created.number}`,
                  reference: created.id,
                  userId: user.id,
                },
              })
            }
          }
        }
      }

      return created
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
      },
    })

    return NextResponse.json({
      ok: true,
      item: order,
      // Datos mínimos para emitir por WebSocket desde el cliente
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
    console.error('POST /api/mesero/orders', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
