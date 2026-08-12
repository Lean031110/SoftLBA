// ============================================================
// consumeRecipe - Descuenta los ingredientes de una receta del inventario
// ------------------------------------------------------------
// Llamado automáticamente cuando un OrderItem pasa a LISTO.
// Es idempotente: usa reference = `recipe-sync:${orderItemId}` en
// StockMovement para no descontar dos veces el mismo item.
// ============================================================
// v1.0-RC1-bloque1-2 (item 7): soporta recibir un TransactionClient para
// integrarse en la misma transacción que el cambio de estado del item.
// Si consumeRecipe falla, la transacción completa se revierte y el item
// NO se marca como LISTO.
//
// v1.0-RC1-bloque1-2 (item 8): respeta RestaurantConfig.blockNegativeStock.
// Si blockNegativeStock=true y no hay stock suficiente para algún ingrediente,
// se lanza un error (lanzando así la transacción) en lugar de solo registrar
// una alerta.
// ============================================================

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

type TxClient = Prisma.TransactionClient

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
 * Error específico para stock insuficiente cuando blockNegativeStock=true.
 * Permite al llamador distinguir este caso y devolver un mensaje útil al cliente.
 */
export class InsufficientStockError extends Error {
  constructor(public readonly details: ConsumeRecipeResult['deductions']) {
    const messages = details.map(
      (d) => `${d.productName} (área ${d.areaName}): disponible ${d.stockBefore ?? 0}, requerido ${d.quantityNeeded} ${d.unit}`,
    )
    super(`Stock insuficiente: ${messages.join('; ')}`)
    this.name = 'InsufficientStockError'
  }
}

/**
 * Descuenta los ingredientes de la receta del producto `productId` para `quantity` unidades,
 * desde el inventario del área `areaId`.
 *
 * - Si no existe receta para el producto, retorna ok sin hacer nada (crea un marcador
 *   StockMovement con quantity=0 para garantizar idempotencia).
 * - Si blockNegativeStock=true y no hay stock suficiente, lanza InsufficientStockError
 *   (no descuenta nada si alguna validación previa falla dentro de la transacción).
 * - Si blockNegativeStock=false y no hay stock suficiente, DESCUENTA IGUAL y registra
 *   una alerta (no bloquea).
 * - Es idempotente: si ya existe un StockMovement con reference=`recipe-sync:${orderItemId}`,
 *   retorna `{ ok: true, alreadySynced: true }` sin repetir el descuento.
 *
 * @param productId   ID del producto final (debe tener Recipe asociada)
 * @param quantity    Cantidad elaborada del producto final
 * @param areaId      Área desde donde se descuentan los ingredientes (targetAreaId del item o order.areaId)
 * @param orderId     ID del pedido (para logs)
 * @param orderItemId ID del item (clave de idempotencia)
 * @param userId      ID del usuario que marcó el item como LISTO
 * @param tx          Cliente de transacción opcional. Si se pasa, se usa; si no,
 *                    se ejecuta contra el cliente global y arranca su propia transacción.
 */
export async function consumeRecipe(
  productId: string,
  quantity: number,
  areaId: string,
  orderId: string,
  orderItemId: string,
  userId: string,
  tx?: TxClient,
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
  const client = tx ?? db
  const referenceKey = `recipe-sync:${orderItemId}`
  const legacyReferenceKey = `recipe-sync:${orderId}:${orderItemId}`
  const existing = await client.stockMovement.findFirst({
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
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: { number: true, areaId: true },
  })
  const product = await client.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, code: true, unit: true, areaId: true },
  })
  if (!order || !product) {
    // No hay nada que hacer; pero registramos un marcador para no reintentar.
    return { ok: false }
  }

  // v1.0-RC1-bloque1-2 (item 8): leer config global de bloqueo de stock negativo.
  const config = await client.restaurantConfig.findFirst({
    where: { id: 'config-1' },
    select: { blockNegativeStock: true },
  })
  const blockNegative = config?.blockNegativeStock ?? true

  // ============================================================
  // Buscar la receta del producto final
  // ============================================================
  const recipe = await client.recipe.findUnique({
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
    await client.stockMovement.create({
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
  const insufficientDeductions: ConsumeRecipeResult['deductions'] = []

  // ============================================================
  // Procesar cada ingrediente. Si tx fue provisto, NUEVA transacción
  // no se arranca: todo ocurre en la transacción del llamador.
  // Si tx NO fue provisto, arrancamos nuestra propia transacción.
  // ============================================================
  const runOnClient = async (c: TxClient) => {
    for (const ing of recipe.ingredients) {
      const quantityNeeded = Math.round((ing.quantity * scale) * 10000) / 10000 // 4 decimales

      // Área de dónde descontar:
      // 1. área del ingrediente (ingredient.product.areaId)
      // 2. área objetivo del item (targetAreaId = areaId pasado)
      const ingAreaId = ing.product.areaId || areaId

      const area = ingAreaId
        ? await c.area.findUnique({ where: { id: ingAreaId }, select: { id: true, name: true, code: true } })
        : null

      let stockBefore: number | null = null
      let stockAfter: number | null = null
      let source: 'area' | 'general' | 'none' = 'none'
      let insufficient = false
      let alertMsg: string | undefined

      if (ingAreaId) {
        const areaInv = await c.areaInventory.findUnique({
          where: { areaId_productId: { areaId: ingAreaId, productId: ing.productId } },
        })
        if (areaInv) {
          stockBefore = areaInv.stock
          // v1.0-RC1-bloque1-2 (item 9): descuento atómico con condición de stock.
          // Si blockNegative=true, solo descontamos si stock >= quantityNeeded.
          // updateMany devuelve el count de filas afectadas; si es 0, el stock era insuficiente.
          if (blockNegative && (stockBefore ?? 0) < quantityNeeded) {
            insufficient = true
            alertMsg = `Stock insuficiente de "${ing.product.name}" en área ${area?.name}: disponible ${stockBefore}, requerido ${quantityNeeded} ${ing.unit}.`
            alerts.push(alertMsg)
            insufficientDeductions.push({
              productId: ing.productId,
              productName: ing.product.name,
              areaId: ingAreaId,
              areaName: area?.name || '—',
              quantityNeeded,
              unit: ing.unit,
              stockBefore,
              stockAfter: stockBefore,
              source: 'area',
              insufficient: true,
            })
            // No descontamos: skip del movimiento SALIDA si bloquea.
            continue
          }
          // Actualización atómica condicional: solo descuenta si stock >= quantityNeeded.
          // Esto evita race conditions entre pedidos concurrentes.
          const updRes = await c.areaInventory.updateMany({
            where: {
              areaId: ingAreaId,
              productId: ing.productId,
              stock: { gte: quantityNeeded },
            },
            data: { stock: { decrement: quantityNeeded } },
          })
          if (updRes.count > 0) {
            // Recargar para obtener el stock resultante real
            const reloaded = await c.areaInventory.findUnique({
              where: { areaId_productId: { areaId: ingAreaId, productId: ing.productId } },
              select: { stock: true },
            })
            stockAfter = reloaded?.stock ?? null
            source = 'area'
          } else {
            // No se pudo descontar atómicamente (otro pedido concurrente ganó el stock)
            insufficient = true
            alertMsg = `Stock insuficiente (concurrencia) de "${ing.product.name}" en área ${area?.name}: requerido ${quantityNeeded} ${ing.unit}.`
            alerts.push(alertMsg)
            insufficientDeductions.push({
              productId: ing.productId,
              productName: ing.product.name,
              areaId: ingAreaId,
              areaName: area?.name || '—',
              quantityNeeded,
              unit: ing.unit,
              stockBefore,
              stockAfter: stockBefore,
              source: 'area',
              insufficient: true,
            })
            continue
          }
        } else {
          // Sin registro en área: intentar inventario general como fallback
          const genInv = await c.inventoryItem.findUnique({ where: { productId: ing.productId } })
          if (genInv) {
            stockBefore = genInv.stock
            if (blockNegative && (stockBefore ?? 0) < quantityNeeded) {
              insufficient = true
              alertMsg = `Stock insuficiente de "${ing.product.name}" (general): disponible ${stockBefore}, requerido ${quantityNeeded} ${ing.unit}.`
              alerts.push(alertMsg)
              insufficientDeductions.push({
                productId: ing.productId,
                productName: ing.product.name,
                areaId: ingAreaId,
                areaName: area?.name || '—',
                quantityNeeded,
                unit: ing.unit,
                stockBefore,
                stockAfter: stockBefore,
                source: 'general',
                insufficient: true,
              })
              continue
            }
            const updGen = await c.inventoryItem.updateMany({
              where: {
                productId: ing.productId,
                stock: { gte: quantityNeeded },
              },
              data: { stock: { decrement: quantityNeeded } },
            })
            if (updGen.count > 0) {
              const reloaded = await c.inventoryItem.findUnique({
                where: { productId: ing.productId },
                select: { stock: true },
              })
              stockAfter = reloaded?.stock ?? null
              source = 'general'
              insufficient = true // Marcar como insuficiente solo informativamente (no estaba en área)
              alertMsg = `"${ing.product.name}" no tiene stock en área ${area?.name}; descontado del inventario general. Disponible: ${stockBefore}, requerido: ${quantityNeeded} ${ing.unit}.`
              alerts.push(alertMsg)
            } else {
              insufficient = true
              alertMsg = `Stock insuficiente (concurrencia) de "${ing.product.name}" (general).`
              alerts.push(alertMsg)
              insufficientDeductions.push({
                productId: ing.productId,
                productName: ing.product.name,
                areaId: ingAreaId,
                areaName: area?.name || '—',
                quantityNeeded,
                unit: ing.unit,
                stockBefore,
                stockAfter: stockBefore,
                source: 'general',
                insufficient: true,
              })
              continue
            }
          } else {
            insufficient = true
            alertMsg = `"${ing.product.name}" no tiene registro de inventario. No se pudo descontar ${quantityNeeded} ${ing.unit}.`
            alerts.push(alertMsg)
            insufficientDeductions.push({
              productId: ing.productId,
              productName: ing.product.name,
              areaId: ingAreaId,
              areaName: area?.name || '—',
              quantityNeeded,
              unit: ing.unit,
              stockBefore: null,
              stockAfter: null,
              source: 'none',
              insufficient: true,
            })
            continue
          }
        }
      } else {
        // Sin área definida: intentar inventario general
        const genInv = await c.inventoryItem.findUnique({ where: { productId: ing.productId } })
        if (genInv) {
          stockBefore = genInv.stock
          if (blockNegative && (stockBefore ?? 0) < quantityNeeded) {
            insufficient = true
            alertMsg = `Stock insuficiente de "${ing.product.name}" (general): disponible ${stockBefore}, requerido ${quantityNeeded} ${ing.unit}.`
            alerts.push(alertMsg)
            insufficientDeductions.push({
              productId: ing.productId,
              productName: ing.product.name,
              areaId: null,
              areaName: '—',
              quantityNeeded,
              unit: ing.unit,
              stockBefore,
              stockAfter: stockBefore,
              source: 'general',
              insufficient: true,
            })
            continue
          }
          const updGen = await c.inventoryItem.updateMany({
            where: {
              productId: ing.productId,
              stock: { gte: quantityNeeded },
            },
            data: { stock: { decrement: quantityNeeded } },
          })
          if (updGen.count > 0) {
            const reloaded = await c.inventoryItem.findUnique({
              where: { productId: ing.productId },
              select: { stock: true },
            })
            stockAfter = reloaded?.stock ?? null
            source = 'general'
            if ((stockBefore ?? 0) < quantityNeeded) {
              insufficient = true
              alertMsg = `Stock insuficiente de "${ing.product.name}" (general): disponible ${stockBefore}, requerido ${quantityNeeded} ${ing.unit}.`
              alerts.push(alertMsg)
            }
          } else {
            insufficient = true
            alertMsg = `Stock insuficiente (concurrencia) de "${ing.product.name}" (general).`
            alerts.push(alertMsg)
            insufficientDeductions.push({
              productId: ing.productId,
              productName: ing.product.name,
              areaId: null,
              areaName: '—',
              quantityNeeded,
              unit: ing.unit,
              stockBefore,
              stockAfter: stockBefore,
              source: 'general',
              insufficient: true,
            })
            continue
          }
        } else {
          insufficient = true
          alertMsg = `"${ing.product.name}" no tiene inventario registrado. No se pudo descontar ${quantityNeeded} ${ing.unit}.`
          alerts.push(alertMsg)
          insufficientDeductions.push({
            productId: ing.productId,
            productName: ing.product.name,
            areaId: null,
            areaName: '—',
            quantityNeeded,
            unit: ing.unit,
            stockBefore: null,
            stockAfter: null,
            source: 'none',
            insufficient: true,
          })
          continue
        }
      }

      // Crear StockMovement SALIDA con la referencia de idempotencia
      await c.stockMovement.create({
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
  }

  if (tx) {
    // Ejecutar en la transacción del llamador.
    await runOnClient(tx)
  } else {
    // Arrancar nuestra propia transacción.
    await db.$transaction(runOnClient)
  }

  // v1.0-RC1-bloque1-2 (item 8): si blockNegative y hubo stock insuficiente,
  // lanzar error para revertir la transacción del llamador.
  if (blockNegative && insufficientDeductions.length > 0) {
    throw new InsufficientStockError(insufficientDeductions)
  }

  return {
    ok: true,
    deductionsCount: deductions.length,
    alertsCount: alerts.length,
    alerts,
    deductions,
  }
}
