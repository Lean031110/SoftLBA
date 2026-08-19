// src/lib/print/print-service.ts
// ============================================================
// PrintService — Servicio de impresión profesional
// ============================================================
// v1.1.0-rc6: Implementación real del PrintService.
// FASE 3: logger estructurado.
//
// Responsabilidades:
//   1. Generar PrintJobs cuando se crea/envía un pedido (por área).
//   2. Construir el contenido del ticket (formato ESC/POS o texto).
//   3. Intentar imprimir via TCP (ip:port) usando ESC/POS.
//   4. Manejar reintentos, fallback a impresora secundaria.
//   5. Actualizar estado del PrintJob (PENDING→PRINTING→PRINTED/FAILED).
//
// Arquitectura:
//   Order creation → PrintService.createPrintJobsForOrder()
//   → PrintJob PENDING por área
//   → PrintService.processQueue() (worker periódico)
//   → PrintService.sendToPrinter() (TCP/ESC/POS)
//   → PrintJob PRINTED o FAILED
//
// NO acoplar a React ni a Socket.IO. Es puro backend.
// ============================================================

import { db } from '../db'
import { logger } from '../logger'
import * as net from 'net'

// === TIPOS ===
export type PrintJobStatus = 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'CANCELLED'
export type OutputMode = 'DISPLAY' | 'PRINTER' | 'DISPLAY_AND_PRINTER' | 'AUTO'

export interface TicketLine {
  text: string
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  size?: 'normal' | 'double'
}

export interface AreaTicket {
  areaCode: string
  areaName: string
  orderNumber: number
  tableName: string | null
  customerName: string | null
  userName: string
  createdAt: Date
  items: Array<{
    quantity: number
    productName: string
    notes?: string | null
  }>
  orderNotes?: string | null
}

// === GENERACIÓN DE PRINT JOBS ===

/**
 * Crea PrintJobs por área cuando se crea/envía un pedido.
 * Solo crea jobs para áreas cuyo outputMode incluye PRINTER.
 *
 * @param orderId ID del pedido recién creado
 * @param tx Transacción Prisma opcional (para usar dentro de la misma tx del pedido)
 */
export async function createPrintJobsForOrder(
  orderId: string,
  tx?: any,
): Promise<{ created: number; skipped: number }> {
  const client = tx || db
  let created = 0
  let skipped = 0

  // Cargar el pedido con items, áreas y productos
  const order = await client.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true } },
      area: true,
      table: true,
      user: { select: { firstName: true, lastName: true, username: true } },
    },
  })
  if (!order) return { created: 0, skipped: 0 }

  // Agrupar items por targetAreaId
  const itemsByArea = new Map<string, typeof order.items>()
  for (const item of order.items) {
    if (item.status === 'CANCELADO') continue
    // DIRECTO no genera PrintJob (se despacha en SALÓN, no imprime ticket de producción)
    if (item.product.type === 'DIRECTO') continue

    const areaId = item.targetAreaId || order.areaId
    if (!itemsByArea.has(areaId)) {
      itemsByArea.set(areaId, [])
    }
    itemsByArea.get(areaId)!.push(item)
  }

  // Para cada área con items, verificar outputMode y crear PrintJob si corresponde
  for (const [areaId, items] of itemsByArea) {
    const area = await client.area.findUnique({ where: { id: areaId } })
    if (!area) { skipped++; continue }

    const outputMode = (area.outputMode || 'DISPLAY') as OutputMode
    // Solo crear PrintJob si el outputMode incluye PRINTER
    if (outputMode !== 'PRINTER' && outputMode !== 'DISPLAY_AND_PRINTER' && outputMode !== 'AUTO') {
      skipped++
      continue
    }

    // Buscar impresora activa para esta área
    const printer = await client.printer.findFirst({
      where: { areaId, isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!printer) {
      skipped++
      continue
    }

    // Construir el contenido del ticket
    const ticket: AreaTicket = {
      areaCode: area.code,
      areaName: area.name,
      orderNumber: order.number,
      tableName: order.table?.name || null,
      customerName: order.customerName,
      userName: order.user.firstName || order.user.username,
      createdAt: order.createdAt,
      items: items.map((i: any) => ({
        quantity: i.quantity,
        productName: i.product.name,
        notes: i.notes,
      })),
      orderNotes: order.notes,
    }

    const content = buildTicketContent(ticket, printer.charsPerLine, printer.header, printer.footer)

    // Crear PrintJob con idempotencyKey
    const idempotencyKey = `print-${orderId}-${areaId}`

    // Verificar si ya existe (idempotencia)
    const existing = await client.printJob.findFirst({
      where: { idempotencyKey },
    })
    if (existing) {
      skipped++
      continue
    }

    await client.printJob.create({
      data: {
        orderId,
        areaId,
        printerId: printer.id,
        status: 'PENDING',
        content: JSON.stringify(content),
        idempotencyKey,
      },
    })
    created++
  }

  return { created, skipped }
}

// === CONSTRUCCIÓN DE TICKET ===

/**
 * Construye el contenido del ticket como array de líneas.
 * Este formato es independiente del protocolo (ESC/POS, texto, HTML).
 */
export function buildTicketContent(
  ticket: AreaTicket,
  charsPerLine: number = 48,
  header?: string | null,
  footer?: string | null,
): TicketLine[] {
  const lines: TicketLine[] = []
  const divider = '='.repeat(charsPerLine)
  const dividerThin = '-'.repeat(charsPerLine)

  // Header personalizado
  if (header) {
    lines.push({ text: header, align: 'center', bold: true })
  }

  // Área
  lines.push({ text: ticket.areaName.toUpperCase(), align: 'center', bold: true, size: 'double' })
  lines.push({ text: divider, align: 'center' })

  // Info del pedido
  lines.push({ text: `PEDIDO #${ticket.orderNumber}`, bold: true })
  if (ticket.tableName) {
    lines.push({ text: `MESA: ${ticket.tableName}`, bold: true })
  } else {
    lines.push({ text: 'PARA LLEVAR', bold: true })
  }
  if (ticket.customerName) {
    lines.push({ text: `CLIENTE: ${ticket.customerName}` })
  }
  lines.push({ text: `MESERO: ${ticket.userName}` })
  lines.push({ text: `HORA: ${ticket.createdAt.toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit' })}` })
  lines.push({ text: dividerThin, align: 'center' })

  // Items
  for (const item of ticket.items) {
    lines.push({
      text: `${item.quantity} × ${item.productName}`,
      bold: true,
      size: 'double',
    })
    if (item.notes) {
      lines.push({ text: `  >> ${item.notes}`, align: 'left' })
    }
  }

  // Notas generales
  if (ticket.orderNotes) {
    lines.push({ text: dividerThin, align: 'center' })
    lines.push({ text: `NOTAS: ${ticket.orderNotes}` })
  }

  // Footer
  lines.push({ text: divider, align: 'center' })
  if (footer) {
    lines.push({ text: footer, align: 'center' })
  }
  lines.push({ text: `Generado por SoftLBA`, align: 'center' })

  return lines
}

// === ENVÍO A IMPRESORA ===

/**
 * Intenta imprimir un PrintJob via TCP/ESC/POS.
 * Retorna true si tuvo éxito, false si falló.
 *
 * NOTA: Esta función usa net.Socket de Node.js para conectarse
 * directamente a la impresora térmica en la LAN.
 */
export async function sendToPrinter(
  printer: { ipAddress: string | null; port: number },
  content: TicketLine[],
): Promise<{ ok: boolean; error?: string }> {
  if (!printer.ipAddress) {
    return { ok: false, error: 'Impresora sin IP configurada' }
  }

  // Convertir TicketLine[] a comandos ESC/POS
  const escposData = convertToEscPos(content)

  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        socket.destroy()
        resolve({ ok: false, error: 'Timeout de conexión (5s)' })
      }
    }, 5000)

    socket.connect(printer.port, printer.ipAddress!, () => {
      socket.write(escposData, (err: any) => {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          if (err) {
            resolve({ ok: false, error: `Error al escribir: ${err.message}` })
          } else {
            socket.end()
            resolve({ ok: true })
          }
        }
      })
    })

    socket.on('error', (err: any) => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        resolve({ ok: false, error: `Error de conexión: ${err.message}` })
      }
    })

    socket.on('close', () => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        resolve({ ok: true })
      }
    })
  })
}

/**
 * Convierte TicketLine[] a bytes ESC/POS.
 * Comandos básicos: init, bold, align, cut, feed.
 */
function convertToEscPos(lines: TicketLine[]): Buffer {
  const parts: Buffer[] = []

  // ESC @ — inicializar impresora
  parts.push(Buffer.from([0x1b, 0x40]))

  for (const line of lines) {
    // Alineación: ESC a n
    const align = line.align === 'center' ? 1 : line.align === 'right' ? 2 : 0
    parts.push(Buffer.from([0x1b, 0x61, align]))

    // Bold: ESC E n
    parts.push(Buffer.from([0x1b, 0x45, line.bold ? 1 : 0]))

    // Tamaño: GS ! n (double width+height = 0x30)
    if (line.size === 'double') {
      parts.push(Buffer.from([0x1d, 0x21, 0x30]))
    } else {
      parts.push(Buffer.from([0x1d, 0x21, 0x00]))
    }

    // Texto + newline
    parts.push(Buffer.from(line.text + '\n', 'latin1'))
  }

  // Feed + cut
  parts.push(Buffer.from([0x1b, 0x64, 0x03])) // Feed 3 lines
  parts.push(Buffer.from([0x1d, 0x56, 0x00])) // Partial cut

  return Buffer.concat(parts)
}

// === PROCESAMIENTO DE COLA ===

/**
 * Procesa todos los PrintJobs en estado PENDING.
 * Esta función debe llamarse periódicamente (cada 5s) desde un worker.
 */
export async function processPrintQueue(): Promise<{
  processed: number
  printed: number
  failed: number
}> {
  const pendingJobs = await db.printJob.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 10, // Procesar de a 10 por iteración
    include: { printer: true },
  })

  let printed = 0
  let failed = 0

  for (const job of pendingJobs) {
    if (!job.printer) {
      await db.printJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: 'Sin impresora asignada', lastAttemptAt: new Date() },
      })
      failed++
      continue
    }

    // Marcar como PRINTING
    await db.printJob.update({
      where: { id: job.id },
      data: { status: 'PRINTING', startedAt: new Date(), attempts: { increment: 1 } },
    })

    // Parsear contenido
    let content: TicketLine[]
    try {
      content = JSON.parse(job.content || '[]')
    } catch {
      await db.printJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: 'Contenido inválido', lastAttemptAt: new Date() },
      })
      failed++
      continue
    }

    // Intentar imprimir
    const result = await sendToPrinter(job.printer, content)

    if (result.ok) {
      await db.printJob.update({
        where: { id: job.id },
        data: { status: 'PRINTED', printedAt: new Date(), lastAttemptAt: new Date(), error: null },
      })
      printed++
    } else {
      // Intentar fallback si existe
      const fallbackPrinter = job.printer.fallbackPrinterId
        ? await db.printer.findUnique({ where: { id: job.printer.fallbackPrinterId } })
        : null

      if (fallbackPrinter && fallbackPrinter.isActive) {
        const fallbackResult = await sendToPrinter(fallbackPrinter, content)
        if (fallbackResult.ok) {
          await db.printJob.update({
            where: { id: job.id },
            data: {
              status: 'PRINTED',
              printedAt: new Date(),
              lastAttemptAt: new Date(),
              printerId: fallbackPrinter.id, // Cambiar a la impresora que funcionó
              error: `Fallback desde ${job.printer.name}`,
            },
          })
          printed++
          continue
        }
      }

      await db.printJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: result.error, lastAttemptAt: new Date() },
      })
      failed++
    }
  }

  return { processed: pendingJobs.length, printed, failed }
}

// === UTILIDADES ===

/**
 * Prueba la conexión con una impresora.
 * Envía un ticket de prueba simple.
 */
export async function testPrinter(printerId: string): Promise<{
  ok: boolean
  error?: string
  latencyMs?: number
}> {
  const printer = await db.printer.findUnique({ where: { id: printerId } })
  if (!printer) return { ok: false, error: 'Impresora no encontrada' }

  const testContent: TicketLine[] = [
    { text: 'PRUEBA DE IMPRESORA', align: 'center', bold: true, size: 'double' },
    { text: 'SoftLBA', align: 'center' },
    { text: `Impresora: ${printer.name}`, align: 'center' },
    { text: `Fecha: ${new Date().toLocaleString('es-CU')}`, align: 'center' },
    { text: 'Si ves esto, la impresora funciona.', align: 'center' },
  ]

  const start = Date.now()
  const result = await sendToPrinter(printer, testContent)
  const latencyMs = Date.now() - start

  return { ...result, latencyMs }
}

/**
 * Reintenta un PrintJob específico.
 */
export async function retryPrintJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const job = await db.printJob.findUnique({
    where: { id: jobId },
    include: { printer: true },
  })
  if (!job) return { ok: false, error: 'PrintJob no encontrado' }
  if (job.status === 'PRINTED') return { ok: true, error: 'Ya impreso' }

  // Reset a PENDING para que el worker lo procese
  await db.printJob.update({
    where: { id: jobId },
    data: { status: 'PENDING', error: null },
  })

  return { ok: true }
}

/**
 * Cancela un PrintJob.
 */
export async function cancelPrintJob(jobId: string): Promise<{ ok: boolean }> {
  await db.printJob.update({
    where: { id: jobId },
    data: { status: 'CANCELLED' },
  })
  return { ok: true }
}
