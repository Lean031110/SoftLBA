// POST /api/admin/inventario/sync-recipe
// Sincroniza el inventario con la receta del producto de un item marcado como LISTO.
// Descuenta los ingredientes del inventario del área correspondiente.
// Es idempotente: no descuenta 2 veces el mismo item (controlado por reference en StockMovement).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const SyncSchema = z.object({
  orderId: z.string().min(1),
  itemId: z.string().min(1),
})

interface IngredientDeduction {
  productId: string
  productName: string
  productCode: string
  unit: string
  areaId: string | null
  areaName: string
  quantityNeeded: number
  stockBefore: number | null
  stockAfter: number | null
  source: 'area' | 'general' | 'none'
  insufficient: boolean
  alert?: string
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = SyncSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const { orderId, itemId } = parsed.data

    // ============================================================
    // Validar orden e item
    // ============================================================
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        area: { select: { id: true, name: true, code: true } },
        items: {
          where: { id: itemId },
          include: {
            product: {
              select: {
                id: true, code: true, name: true, unit: true, type: true, areaId: true,
              },
            },
          },
          take: 1,
        },
      },
    })

    if (!order) {
      return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
    }
    const item = order.items[0]
    if (!item) {
      return NextResponse.json({ ok: false, error: 'Item no encontrado en el pedido' }, { status: 404 })
    }

    // ============================================================
    // Idempotencia: si ya existe un movimiento con la referencia,
    // NO se descuenta de nuevo.
    // ============================================================
    const referenceKey = `recipe-sync:${orderId}:${itemId}`
    const existing = await db.stockMovement.findFirst({
      where: { reference: referenceKey },
      select: { id: true, createdAt: true },
    })
    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadySynced: true,
        message: 'El item ya fue sincronizado previamente con la receta',
        syncedAt: existing.createdAt,
      })
    }

    // ============================================================
    // Buscar la receta del producto final
    // ============================================================
    const recipe = await db.recipe.findUnique({
      where: { productId: item.productId },
      include: {
        ingredients: {
          include: {
            product: {
              select: {
                id: true, code: true, name: true, unit: true,
                cost: true, areaId: true, type: true,
              },
            },
          },
        },
      },
    })

    // Si el producto no tiene receta, no hay nada que descontar.
    // Igual registramos la "sincronización" para no reintentar.
    if (!recipe || recipe.ingredients.length === 0) {
      // Creamos un StockMovement "marcador" con quantity=0 para que
      // el control de idempotencia funcione aunque no haya receta.
      await db.stockMovement.create({
        data: {
          type: 'SALIDA',
          productId: item.productId,
          areaId: item.targetAreaId || order.areaId,
          quantity: 0,
          unit: item.product.unit || 'unidad',
          reason: `Sincronización sin receta (producto sin ingredientes)`,
          reference: referenceKey,
          userId: user.id,
        },
      })

      await audit({
        userId: user.id,
        action: 'SYNC_RECIPE_NO_RECIPE',
        entity: 'order-item',
        entityId: itemId,
        after: {
          orderId, itemId, productId: item.productId,
          message: 'Producto sin receta; no se descontaron ingredientes',
        },
      })

      return NextResponse.json({
        ok: true,
        noRecipe: true,
        message: 'El producto no tiene receta. No se descontaron ingredientes.',
      })
    }

    // ============================================================
    // Calcular factor de escala según yield de la receta
    // ============================================================
    const yieldQty = recipe.yield > 0 ? recipe.yield : 1
    const scale = item.quantity / yieldQty

    // ============================================================
    // Procesar cada ingrediente
    // ============================================================
    const deductions: IngredientDeduction[] = []
    const alerts: string[] = []

    await db.$transaction(async (tx) => {
      for (const ing of recipe.ingredients) {
        const quantityNeeded = Math.round((ing.quantity * scale) * 10000) / 10000 // 4 decimales

        // Determinar el área de dónde descontar:
        // 1. área del ingrediente (ingredient.product.areaId)
        // 2. área objetivo del item (targetAreaId, donde se prepara)
        // 3. área del pedido (order.areaId)
        const areaId = ing.product.areaId || item.targetAreaId || order.areaId

        const area = areaId
          ? await tx.area.findUnique({ where: { id: areaId }, select: { id: true, name: true, code: true } })
          : null

        // Buscar stock en el área
        let stockBefore: number | null = null
        let stockAfter: number | null = null
        let source: 'area' | 'general' | 'none' = 'none'
        let insufficient = false
        let alertMsg: string | undefined

        if (areaId) {
          const areaInv = await tx.areaInventory.findUnique({
            where: { areaId_productId: { areaId, productId: ing.productId } },
          })
          if (areaInv) {
            stockBefore = areaInv.stock
            // Restar (puede quedar negativo si no hay suficiente; la alerta lo registra)
            const updated = await tx.areaInventory.update({
              where: { id: areaInv.id },
              data: { stock: { decrement: quantityNeeded } },
            })
            stockAfter = updated.stock
            source = 'area'
            if (stockBefore < quantityNeeded) {
              insufficient = true
              alertMsg = `Stock insuficiente de "${ing.product.name}" en área ${area?.name}: disponible ${stockBefore}, requerido ${quantityNeeded} ${ing.unit}. Stock resultante: ${stockAfter}.`
              alerts.push(alertMsg)
            }
          } else {
            // Sin registro en área: intentar inventario general como fallback
            const genInv = await tx.inventoryItem.findUnique({ where: { productId: ing.productId } })
            if (genInv) {
              stockBefore = genInv.stock
              const updated = await tx.inventoryItem.update({
                where: { productId: ing.productId },
                data: { stock: { decrement: quantityNeeded } },
              })
              stockAfter = updated.stock
              source = 'general'
              insufficient = true
              alertMsg = `"${ing.product.name}" no tiene stock en área ${area?.name}; descontado del inventario general. Disponible: ${stockBefore}, requerido: ${quantityNeeded} ${ing.unit}.`
              alerts.push(alertMsg)
            } else {
              insufficient = true
              alertMsg = `"${ing.product.name}" no tiene registro de inventario. No se pudo descontar ${quantityNeeded} ${ing.unit}.`
              alerts.push(alertMsg)
            }
          }
        } else {
          // Sin área definida: intentar inventario general
          const genInv = await tx.inventoryItem.findUnique({ where: { productId: ing.productId } })
          if (genInv) {
            stockBefore = genInv.stock
            const updated = await tx.inventoryItem.update({
              where: { productId: ing.productId },
              data: { stock: { decrement: quantityNeeded } },
            })
            stockAfter = updated.stock
            source = 'general'
            if (stockBefore < quantityNeeded) {
              insufficient = true
              alertMsg = `Stock insuficiente de "${ing.product.name}" (general): disponible ${stockBefore}, requerido ${quantityNeeded} ${ing.unit}.`
              alerts.push(alertMsg)
            }
          } else {
            insufficient = true
            alertMsg = `"${ing.product.name}" no tiene inventario registrado. No se pudo descontar ${quantityNeeded} ${ing.unit}.`
            alerts.push(alertMsg)
          }
        }

        // Crear StockMovement SALIDA con la referencia de idempotencia
        await tx.stockMovement.create({
          data: {
            type: 'SALIDA',
            productId: ing.productId,
            areaId: areaId,
            quantity: quantityNeeded,
            unit: ing.unit,
            reason: `Consumo por pedido #${order.number} (item ${item.id.slice(-6)})`,
            reference: referenceKey,
            userId: user.id,
          },
        })

        deductions.push({
          productId: ing.productId,
          productName: ing.product.name,
          productCode: ing.product.code,
          unit: ing.unit,
          areaId,
          areaName: area?.name || '—',
          quantityNeeded,
          stockBefore,
          stockAfter,
          source,
          insufficient,
          alert: alertMsg,
        })
      }
    })

    // ============================================================
    // Audit log principal (SUCCESS o ALERT)
    // ============================================================
    const hasAlerts = alerts.length > 0
    await audit({
      userId: user.id,
      action: 'SYNC_RECIPE',
      entity: 'order-item',
      entityId: itemId,
      result: hasAlerts ? 'ALERT' : 'SUCCESS',
      after: {
        orderId,
        orderNumber: order.number,
        itemId,
        productId: item.productId,
        productName: item.product.name,
        recipeId: recipe.id,
        yield: recipe.yield,
        itemQty: item.quantity,
        scale,
        deductionsCount: deductions.length,
        alertsCount: alerts.length,
        deductions: deductions.map((d) => ({
          product: d.productName,
          area: d.areaName,
          qty: d.quantityNeeded,
          unit: d.unit,
          source: d.source,
          before: d.stockBefore,
          after: d.stockAfter,
          insufficient: d.insufficient,
        })),
      },
    })

    // Si hubo alertas, crear un audit log adicional por cada una para visibilidad
    for (const msg of alerts) {
      await audit({
        userId: user.id,
        action: 'STOCK_ALERT',
        entity: 'inventory',
        entityId: itemId,
        result: 'ALERT',
        after: { message: msg, orderId, orderNumber: order.number },
      })
    }

    return NextResponse.json({
      ok: true,
      synced: true,
      orderNumber: order.number,
      itemId,
      productName: item.product.name,
      deductionsCount: deductions.length,
      alertsCount: alerts.length,
      alerts,
      deductions,
    })
  } catch (e: any) {
    console.error('POST /api/admin/inventario/sync-recipe', e)
    return NextResponse.json({ ok: false, error: 'Error interno', detail: e?.message }, { status: 500 })
  }
}
