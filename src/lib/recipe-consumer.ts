// ============================================================
// consumeRecipe - Descuenta los ingredientes de una receta del inventario
// ------------------------------------------------------------
// Llamado automáticamente cuando un OrderItem pasa a LISTO.
// Es idempotente: usa reference = `recipe-sync:${orderItemId}` en
// StockMovement para no descontar dos veces el mismo item.
// ============================================================

import { db } from '@/lib/db'

export interface ConsumeRecipeResult {
  ok: boolean
  alreadySynced?: boolean
  noRecipe?: boolean
  deductionsCount?: number
  alertsCount?: number
  alerts?: string[]
  deductions?: Array<{
    productId: string
    productName: string
    areaId: string | null
    areaName: string
    quantityNeeded: number
    unit: string
    stockBefore: number | null
    stockAfter: number | null
    source: 'area' | 'general' | 'none'
    insufficient: boolean
  }>
}

/**
 * Descuenta los ingredientes de la receta del producto `productId` para `quantity` unidades,
 * desde el inventario del área `areaId`.
 *
 * - Si no existe receta para el producto, retorna ok sin hacer nada (crea un marcador
 *   StockMovement con quantity=0 para garantizar idempotencia).
 * - Si no hay stock suficiente, DESCUENTA IGUAL y registra una alerta (no bloquea).
 * - Todo ocurre en una transacción Prisma.
 * - Es idempotente: si ya existe un StockMovement con reference=`recipe-sync:${orderItemId}`,
 *   retorna `{ ok: true, alreadySynced: true }` sin repetir el descuento.
 *
 * @param productId   ID del producto final (debe tener Recipe asociada)
 * @param quantity    Cantidad elaborada del producto final
 * @param areaId      Área desde donde se descuentan los ingredientes (targetAreaId del item o order.areaId)
 * @param orderId     ID del pedido (para logs)
 * @param orderItemId ID del item (clave de idempotencia)
 * @param userId      ID del usuario que marcó el item como LISTO
 */
export async function consumeRecipe(
  productId: string,
  quantity: number,
  areaId: string,
  orderId: string,
  orderItemId: string,
  userId: string,
): Promise<ConsumeRecipeResult> {
  // ============================================================
  // Idempotencia: si ya existe un movimiento con la referencia,
  // NO se descuenta de nuevo.
  // ------------------------------------------------------------
  // Usamos el formato `recipe-sync:${orderItemId}` (especificado en FIX 3).
  // Para retrocompatibilidad con el endpoint admin sync-recipe existente
  // (que usa `recipe-sync:${orderId}:${orderItemId}`), verificamos AMBOS
  // formatos para que un item auto-consumido no sea doble-descontado por
  // el endpoint admin y viceversa.
  // ============================================================
  const referenceKey = `recipe-sync:${orderItemId}`
  const legacyReferenceKey = `recipe-sync:${orderId}:${orderItemId}`
  const existing = await db.stockMovement.findFirst({
    where: { reference: { in: [referenceKey, legacyReferenceKey] } },
    select: { id: true, createdAt: true, reference: true },
  })
  if (existing) {
    return {
      ok: true,
      alreadySynced: true,
      deductionsCount: 0,
      alertsCount: 0,
      alerts: [],
      deductions: [],
    }
  }

  // Cargar pedido y producto para enriquecer logs
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { number: true, areaId: true },
  })
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, code: true, unit: true, areaId: true },
  })
  if (!order || !product) {
    // No hay nada que hacer; pero registramos un marcador para no reintentar.
    return { ok: false }
  }

  // ============================================================
  // Buscar la receta del producto final
  // ============================================================
  const recipe = await db.recipe.findUnique({
    where: { productId },
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

  // Sin receta: creamos un StockMovement "marcador" con quantity=0 para que
  // el control de idempotencia funcione aunque no haya receta.
  if (!recipe || recipe.ingredients.length === 0) {
    await db.stockMovement.create({
      data: {
        type: 'SALIDA',
        productId,
        areaId,
        quantity: 0,
        unit: product.unit || 'unidad',
        reason: `Sincronización sin receta (producto sin ingredientes)`,
        reference: referenceKey,
        userId,
      },
    })
    return {
      ok: true,
      noRecipe: true,
      deductionsCount: 0,
      alertsCount: 0,
      alerts: [],
      deductions: [],
    }
  }

  // ============================================================
  // Calcular factor de escala según yield de la receta
  // ============================================================
  const yieldQty = recipe.yield > 0 ? recipe.yield : 1
  const scale = quantity / yieldQty

  const alerts: string[] = []
  const deductions: ConsumeRecipeResult['deductions'] = []

  // ============================================================
  // Procesar cada ingrediente en una transacción
  // ============================================================
  await db.$transaction(async (tx) => {
    for (const ing of recipe.ingredients) {
      const quantityNeeded = Math.round((ing.quantity * scale) * 10000) / 10000 // 4 decimales

      // Área de dónde descontar:
      // 1. área del ingrediente (ingredient.product.areaId)
      // 2. área objetivo del item (targetAreaId = areaId pasado)
      const ingAreaId = ing.product.areaId || areaId

      const area = ingAreaId
        ? await tx.area.findUnique({ where: { id: ingAreaId }, select: { id: true, name: true, code: true } })
        : null

      let stockBefore: number | null = null
      let stockAfter: number | null = null
      let source: 'area' | 'general' | 'none' = 'none'
      let insufficient = false
      let alertMsg: string | undefined

      if (ingAreaId) {
        const areaInv = await tx.areaInventory.findUnique({
          where: { areaId_productId: { areaId: ingAreaId, productId: ing.productId } },
        })
        if (areaInv) {
          stockBefore = areaInv.stock
          const updated = await tx.areaInventory.update({
            where: { id: areaInv.id },
            data: { stock: { decrement: quantityNeeded } },
          })
          stockAfter = updated.stock
          source = 'area'
          if ((stockBefore ?? 0) < quantityNeeded) {
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
          if ((stockBefore ?? 0) < quantityNeeded) {
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
          areaId: ingAreaId,
          quantity: quantityNeeded,
          unit: ing.unit,
          reason: `Consumo por pedido #${order.number} (item ${orderItemId.slice(-6)})`,
          reference: referenceKey,
          userId,
        },
      })

      deductions.push({
        productId: ing.productId,
        productName: ing.product.name,
        areaId: ingAreaId,
        areaName: area?.name || '—',
        quantityNeeded,
        unit: ing.unit,
        stockBefore,
        stockAfter,
        source,
        insufficient,
      })
    }
  })

  return {
    ok: true,
    deductionsCount: deductions.length,
    alertsCount: alerts.length,
    alerts,
    deductions,
  }
}
