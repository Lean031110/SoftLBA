// POST /api/mesero/orders/[id]/transfer-table - Transferir pedido a otra mesa (FIX 19)
// ------------------------------------------------------------
// Recibe:
//   tableId: string (ID de la nueva mesa, obligatorio)
// Efectos:
//   - Si el pedido ya tenía mesa asignada, la libera (status=LIBRE).
//   - Marca la nueva mesa como OCUPADA.
//   - Actualiza order.tableId = nuevaMesa.
//   - Audit log con before/after.
// Restricciones:
//   - Solo se permite transferir pedidos activos (no CANCELADO/ARCHIVADO/COBRADO).
//   - La nueva mesa debe existir, estar activa y pertenecer al mismo área
//     (si el pedido tiene areaId, que siempre es así).
//   - La nueva mesa no puede estar OCUPADA ya (salvo que sea admin).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { hasPerm, PERMISSIONS } from '@/lib/permissions/permissions-v2'
import { z } from 'zod'

const TransferSchema = z.object({
  tableId: z.string().min(1, 'Debes indicar la mesa destino'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!hasPerm(user.role, PERMISSIONS.ORDER_EDIT)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params

    const order = await db.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
    }
    // Permisos: mesero solo transfiere sus propios pedidos; admin cualquiera
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    if (['CANCELADO', 'ARCHIVADO', 'COBRADO'].includes(order.status)) {
      return NextResponse.json(
        { ok: false, error: 'No se puede transferir un pedido en estado terminal' },
        { status: 400 },
      )
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = TransferSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    }
    const d = parsed.data

    // Validar mesa destino
    const targetTable = await db.table.findUnique({ where: { id: d.tableId } })
    if (!targetTable || !targetTable.isActive) {
      return NextResponse.json({ ok: false, error: 'Mesa destino inválida o inactiva' }, { status: 400 })
    }
    // Si la mesa destino está en área distinta al pedido, rechazar
    // (targetTable.areaId puede ser null = mesas "globales" sin área)
    if (targetTable.areaId && targetTable.areaId !== order.areaId) {
      return NextResponse.json(
        { ok: false, error: 'La mesa destino pertenece a otra área' },
        { status: 400 },
      )
    }
    // Si el pedido ya estaba en esa mesa, no hay nada que hacer
    if (order.tableId === targetTable.id) {
      return NextResponse.json({ ok: false, error: 'El pedido ya está en esa mesa' }, { status: 400 })
    }
    // Si la mesa destino está OCUPADA, solo admin puede forzar la transferencia
    // (porque probablemente haya que reconciliar dos pedidos en la misma mesa)
    if (targetTable.status === 'OCUPADA' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'La mesa destino ya está ocupada' },
        { status: 400 },
      )
    }

    const before = {
      tableId: order.tableId,
      tableName: null as string | null,
      tableStatus: null as string | null,
    }
    let oldTable: { id: string; name: string; status: string } | null = null
    if (order.tableId) {
      oldTable = await db.table.findUnique({
        where: { id: order.tableId },
        select: { id: true, name: true, status: true },
      })
      if (oldTable) {
        before.tableName = oldTable.name
        before.tableStatus = oldTable.status
      }
    }

    const result = await db.$transaction(async (tx) => {
      // Liberar mesa anterior si existía
      if (oldTable) {
        await tx.table.update({
          where: { id: oldTable.id },
          data: { status: 'LIBRE' },
        })
      }
      // Marcar mesa destino como OCUPADA
      await tx.table.update({
        where: { id: targetTable.id },
        data: { status: 'OCUPADA' },
      })
      // Actualizar pedido
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { tableId: targetTable.id },
      })
      return updated
    })

    await audit({
      userId: user.id,
      action: 'ORDER_TRANSFER_TABLE',
      entity: 'order',
      entityId: order.id,
      before: {
        tableId: before.tableId,
        tableName: before.tableName,
        tableStatus: before.tableStatus,
      },
      after: {
        tableId: targetTable.id,
        tableName: targetTable.name,
        tableStatus: 'OCUPADA',
        previousTableReleased: !!oldTable,
      },
    })

    return NextResponse.json({
      ok: true,
      item: result,
      newTable: { id: targetTable.id, name: targetTable.name, status: 'OCUPADA' },
      oldTableReleased: !!oldTable,
    })
  } catch (e: any) {
    console.error('POST /api/mesero/orders/[id]/transfer-table', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
