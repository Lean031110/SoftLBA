// GET /api/admin/export?type=pdf|excel&data=orders|finances|inventory&from=YYYY-MM-DD&to=YYYY-MM-DD
// Exporta pedidos, finanzas o inventario a PDF (jspdf) o Excel (exceljs).
// Solo ADMIN.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'

type DataType = 'orders' | 'finances' | 'inventory'
type ExportType = 'pdf' | 'excel'

interface ColumnDef {
  header: string
  key: string
  width?: number
}

// ============================================================
// Helpers de formato
// ============================================================

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fmtDateOnly(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

function fmtNumber(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '0'
  return Number(n).toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

function fmtMoney(n: number | null | undefined, currency = ''): string {
  const num = fmtNumber(n, 2)
  return currency ? `${num} ${currency}` : num
}

// ============================================================
// Recolección de datos
// ============================================================

async function getOrdersData(from?: string, to?: string) {
  const where: any = {}
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from + 'T00:00:00')
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999')
  }

  const orders = await db.order.findMany({
    where,
    include: {
      user: { select: { id: true, username: true, firstName: true, lastName: true } },
      area: { select: { id: true, name: true } },
      table: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true } },
        },
      },
      payments: { select: { id: true, method: true, amount: true, currency: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = orders.map((o) => {
    const mesero = [o.user?.firstName, o.user?.lastName].filter(Boolean).join(' ') || o.user?.username || '—'
    const mesa = o.table?.name || '—'
    const items = o.items
      .map((it) => `${it.quantity}× ${it.product?.name || '—'}`)
      .join(', ') || '—'
    const metodo = o.payments?.length
      ? o.payments.map((p) => `${p.method}${p.currency ? ' ' + p.currency : ''}`).join(' + ')
      : (o.paymentStatus || '—')
    return {
      numero: `#${o.number}`,
      fecha: fmtDate(o.createdAt),
      mesero,
      area: o.area?.name || '—',
      mesa,
      items,
      total: fmtMoney(o.total),
      estado: o.status,
      metodoPago: metodo,
    }
  })

  const columns: ColumnDef[] = [
    { header: 'Número', key: 'numero', width: 10 },
    { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Mesero', key: 'mesero', width: 22 },
    { header: 'Área', key: 'area', width: 16 },
    { header: 'Mesa', key: 'mesa', width: 14 },
    { header: 'Items', key: 'items', width: 50 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Método de Pago', key: 'metodoPago', width: 24 },
  ]

  return { rows, columns, title: 'Pedidos' }
}

async function getFinancesData(from?: string, to?: string) {
  const where: any = {}
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from + 'T00:00:00')
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999')
  }

  const entries = await db.financeEntry.findMany({
    where,
    include: {
      user: { select: { id: true, username: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = entries.map((e) => ({
    fecha: fmtDate(e.createdAt),
    tipo: e.type,
    categoria: e.category,
    descripcion: e.description,
    monto: fmtMoney(e.amount, e.currency),
    moneda: e.currency,
    referencia: e.reference || '—',
    usuario: [e.user?.firstName, e.user?.lastName].filter(Boolean).join(' ') || e.user?.username || '—',
  }))

  const columns: ColumnDef[] = [
    { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Categoría', key: 'categoria', width: 22 },
    { header: 'Descripción', key: 'descripcion', width: 40 },
    { header: 'Monto', key: 'monto', width: 16 },
    { header: 'Moneda', key: 'moneda', width: 10 },
    { header: 'Referencia', key: 'referencia', width: 18 },
    { header: 'Usuario', key: 'usuario', width: 22 },
  ]

  return { rows, columns, title: 'Finanzas' }
}

async function getInventoryData() {
  const areas = await db.area.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  })

  const products = await db.product.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      cost: true,
      price: true,
      minStock: true,
      inventory: { select: { stock: true, reserved: true } },
      areaStocks: { select: { areaId: true, stock: true, minStock: true } },
    },
  })

  const rows = products.map((p) => {
    const row: Record<string, any> = {
      producto: p.name,
      codigo: p.code,
      unidad: p.unit,
      stockGeneral: fmtNumber(p.inventory?.stock ?? 0),
      reservado: fmtNumber(p.inventory?.reserved ?? 0),
      costo: fmtMoney(p.cost),
      precio: fmtMoney(p.price),
      minStock: fmtNumber(p.minStock),
    }
    // Stock por área (una columna por área)
    for (const a of areas) {
      const stk = p.areaStocks.find((s) => s.areaId === a.id)
      row[`area_${a.id}`] = stk ? fmtNumber(stk.stock) : '0'
    }
    return row
  })

  const columns: ColumnDef[] = [
    { header: 'Producto', key: 'producto', width: 30 },
    { header: 'Código', key: 'codigo', width: 14 },
    { header: 'Unidad', key: 'unidad', width: 10 },
    { header: 'Stock General', key: 'stockGeneral', width: 14 },
    { header: 'Reservado', key: 'reservado', width: 12 },
    { header: 'Costo', key: 'costo', width: 12 },
    { header: 'Precio', key: 'precio', width: 12 },
    { header: 'Min Stock', key: 'minStock', width: 12 },
    ...areas.map((a) => ({
      header: a.name,
      key: `area_${a.id}`,
      width: 14,
    })),
  ]

  return { rows, columns, title: 'Inventario' }
}

// ============================================================
// Generadores de archivo
// ============================================================

async function generateExcel(
  data: { rows: Record<string, any>[]; columns: ColumnDef[]; title: string },
  meta: { restaurantName: string; range: string },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = meta.restaurantName
  wb.created = new Date()

  const ws = wb.addWorksheet(data.title.slice(0, 31))

  // Fila 1: Título del reporte
  ws.getCell('A1').value = `${meta.restaurantName} — Reporte de ${data.title}`
  ws.getCell('A1').font = { bold: true, size: 14 }
  ws.mergeCells(1, 1, 1, data.columns.length)

  // Fila 2: Rango de fechas
  ws.getCell('A2').value = `Rango: ${meta.range}`
  ws.getCell('A2').font = { italic: true, size: 10 }
  ws.mergeCells(2, 1, 2, data.columns.length)

  // Fila 3: Headers en negrita
  const headerRowNum = 4
  data.columns.forEach((col, i) => {
    const cell = ws.getCell(headerRowNum, i + 1)
    cell.value = col.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    }
    cell.alignment = { horizontal: 'left', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    }
  })

  // Filas de datos
  data.rows.forEach((row, rowIdx) => {
    data.columns.forEach((col, colIdx) => {
      const cell = ws.getCell(headerRowNum + 1 + rowIdx, colIdx + 1)
      cell.value = row[col.key] ?? ''
      cell.alignment = { horizontal: 'left', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      }
    })
  })

  // Auto-ancho de columnas
  data.columns.forEach((col, i) => {
    let maxLen = col.header.length
    for (const row of data.rows) {
      const v = row[col.key]
      const len = v ? String(v).length : 0
      if (len > maxLen) maxLen = len
    }
    // Limitar a 60 caracteres
    ws.getColumn(i + 1).width = Math.min(60, Math.max(12, maxLen + 2))
  })

  // Congelar fila de headers
  ws.views = [{ state: 'frozen', ySplit: headerRowNum }]

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

function generatePDF(
  data: { rows: Record<string, any>[]; columns: ColumnDef[]; title: string },
  meta: { restaurantName: string; range: string; generatedAt: string },
): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10

  // ===== Header =====
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(meta.restaurantName, pageWidth / 2, 14, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Reporte de ${data.title}`, pageWidth / 2, 21, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text(`Rango: ${meta.range}`, pageWidth / 2, 26, { align: 'center' })

  // ===== Tabla =====
  const startY = 34
  const rowHeight = 5.5
  const headerHeight = 7

  // Calcular ancho de columnas proporcional al ancho útil
  const usableWidth = pageWidth - margin * 2
  const totalProportional = data.columns.reduce(
    (s, c) => s + (c.width || 15),
    0,
  )
  const colWidths = data.columns.map((c) => (usableWidth * (c.width || 15)) / totalProportional)

  // Función para dibujar header
  const drawHeader = (y: number) => {
    doc.setFillColor(79, 70, 229)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.rect(margin, y, usableWidth, headerHeight, 'F')
    let x = margin
    data.columns.forEach((col, i) => {
      doc.text(col.header, x + 1, y + headerHeight - 2, { maxWidth: colWidths[i] - 2 })
      x += colWidths[i]
    })
    return y + headerHeight
  }

  let y = drawHeader(startY)

  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'normal')

  data.rows.forEach((row, rowIdx) => {
    // Fondo alterno
    if (rowIdx % 2 === 1) {
      doc.setFillColor(245, 245, 245)
      doc.rect(margin, y, usableWidth, rowHeight, 'F')
    }

    let x = margin
    data.columns.forEach((col, i) => {
      const val = row[col.key] ?? ''
      const text = String(val)
      // Truncar si es muy largo para la columna
      const maxWidth = colWidths[i] - 1
      let display = text
      if (doc.getTextWidth(display) > maxWidth) {
        // Truncar
        while (display.length > 0 && doc.getTextWidth(display + '…') > maxWidth) {
          display = display.slice(0, -1)
        }
        display = display + '…'
      }
      doc.text(display, x + 0.5, y + rowHeight - 1.5, { maxWidth })
      x += colWidths[i]
    })

    // Borde inferior
    doc.setDrawColor(220, 220, 220)
    doc.line(margin, y + rowHeight, margin + usableWidth, y + rowHeight)

    y += rowHeight

    // Salto de página
    if (y > pageHeight - 15) {
      doc.addPage()
      // Footer de la página anterior ya está; en la nueva, repetir header
      y = drawHeader(14)
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'normal')
    }
  })

  // ===== Footer con total de registros =====
  if (y + 8 > pageHeight - 10) {
    doc.addPage()
    y = 14
  }
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  doc.text(
    `Total de registros: ${data.rows.length} — Generado: ${meta.generatedAt}`,
    margin,
    pageHeight - 8,
  )

  const arrayBuf = doc.output('arraybuffer')
  return Buffer.from(arrayBuf)
}

// ============================================================
// Route handler
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const type = (searchParams.get('type') || '').toLowerCase() as ExportType
    const data = (searchParams.get('data') || '').toLowerCase() as DataType
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

    if (!['pdf', 'excel'].includes(type)) {
      return NextResponse.json({ ok: false, error: 'type debe ser pdf o excel' }, { status: 400 })
    }
    if (!['orders', 'finances', 'inventory'].includes(data)) {
      return NextResponse.json({ ok: false, error: 'data debe ser orders, finances o inventory' }, { status: 400 })
    }

    // Validar formato de fechas
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (from && !dateRegex.test(from)) {
      return NextResponse.json({ ok: false, error: 'from debe ser YYYY-MM-DD' }, { status: 400 })
    }
    if (to && !dateRegex.test(to)) {
      return NextResponse.json({ ok: false, error: 'to debe ser YYYY-MM-DD' }, { status: 400 })
    }

    // Obtener nombre del restaurante
    const config = await db.restaurantConfig.findFirst({ select: { name: true, currency: true } })
    const restaurantName = config?.name || 'Restaurante'
    const rangeLabel =
      data === 'inventory'
        ? 'Estado actual'
        : `${from || 'Inicio'} → ${to || 'Hoy'}`
    const generatedAt = fmtDate(new Date())

    // Recolectar datos
    let dataset
    if (data === 'orders') dataset = await getOrdersData(from, to)
    else if (data === 'finances') dataset = await getFinancesData(from, to)
    else dataset = await getInventoryData()

    if (!dataset.rows.length) {
      return NextResponse.json({
        ok: false,
        error: 'No hay registros para exportar con los filtros indicados',
      }, { status: 404 })
    }

    // Generar archivo
    let fileBuffer: Buffer
    let contentType: string
    let fileExt: string

    if (type === 'excel') {
      fileBuffer = await generateExcel(dataset, { restaurantName, range: rangeLabel })
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      fileExt = 'xlsx'
    } else {
      fileBuffer = generatePDF(dataset, { restaurantName, range: rangeLabel, generatedAt })
      contentType = 'application/pdf'
      fileExt = 'pdf'
    }

    const filename = `${dataset.title.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${fileExt}`

    return new NextResponse(fileBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (e: any) {
    console.error('GET /api/admin/export', e)
    return NextResponse.json({ ok: false, error: 'Error interno', detail: e?.message }, { status: 500 })
  }
}
