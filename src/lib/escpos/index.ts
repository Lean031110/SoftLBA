// ============================================================
// ESC/POS - Comandos para impresoras térmicas
// ============================================================
// Genera comandos ESC/POS para enviar a impresoras térmicas
// vía TCP (puerto 9100) o vía API del navegador
// ============================================================

// Comandos ESC/POS básicos
const ESC = '\x1B'
const GS = '\x1D'
const LF = '\n'

// Inicializar impresora
export function init(): string {
  return ESC + '@'
}

// Texto normal
export function text(str: string): string {
  return str
}

// Texto centrado
export function center(str: string): string {
  return ESC + 'a' + '\x01' + str + LF
}

// Texto a la izquierda
export function left(str: string): string {
  return ESC + 'a' + '\x00' + str + LF
}

// Texto a la derecha
export function right(str: string): string {
  return ESC + 'a' + '\x02' + str + LF
}

// Negrita on/off
export function boldOn(): string {
  return ESC + 'E' + '\x01'
}
export function boldOff(): string {
  return ESC + 'E' + '\x00'
}

// Tamaño doble
export function doubleOn(): string {
  return GS + '!' + '\x11'
}
export function doubleOff(): string {
  return GS + '!' + '\x00'
}

// Línea separadora
export function divider(): string {
  return '-'.repeat(32) + LF
}

// Línea punteada
export function dashed(): string {
  return '- '.repeat(16) + LF
}

// Cortar papel
export function cut(): string {
  return GS + 'V' + '\x01'
}

// Generar comprobante completo en ESC/POS
export function generateReceipt(data: {
  restaurantName: string
  address?: string | null
  phone?: string | null
  header?: string | null
  footer?: string | null
  orderNumber: number
  orderId: string
  waiterName: string
  tableName: string
  customerName?: string | null
  items: { name: string; quantity: number; unitPrice: number; notes?: string | null }[]
  subtotal: number
  discountPct: number
  discountAmount: number
  total: number
  payments: { method: string; amount: number }[]
  currencySymbol: string
  createdAt: string
}): string {
  let cmd = ''
  cmd += init()
  
  // Header
  if (data.header) {
    data.header.split('\n').forEach((line) => {
      cmd += center(line)
    })
  }
  cmd += boldOn()
  cmd += doubleOn()
  cmd += center(data.restaurantName)
  cmd += doubleOff()
  cmd += boldOff()
  
  if (data.address) cmd += center(data.address)
  if (data.phone) cmd += center(`Tel: ${data.phone}`)
  
  cmd += dashed()
  
  // Info del pedido
  cmd += left(`Pedido #: ${data.orderNumber}`)
  cmd += left(`ID: ${data.orderId.slice(-8).toUpperCase()}`)
  cmd += left(`Mesero: ${data.waiterName}`)
  cmd += left(`Mesa: ${data.tableName}`)
  if (data.customerName) cmd += left(`Cliente: ${data.customerName}`)
  cmd += left(`Fecha: ${new Date(data.createdAt).toLocaleString('es-CU')}`)
  
  cmd += dashed()
  
  // Items
  cmd += boldOn()
  cmd += left('Cant  Producto              Importe')
  cmd += boldOff()
  cmd += dashed()
  
  for (const item of data.items) {
    const qty = String(item.quantity).padEnd(4)
    const name = item.name.substring(0, 20).padEnd(20)
    const amount = `${data.currencySymbol}${(item.unitPrice * item.quantity).toFixed(2)}`
    cmd += left(`${qty}${name}${amount.padStart(10)}`)
    if (item.notes) {
      cmd += left(`     >> ${item.notes.substring(0, 26)}`)
    }
  }
  
  cmd += dashed()
  
  // Totales
  cmd += left(`Subtotal: ${data.currencySymbol}${data.subtotal.toFixed(2)}`)
  if (data.discountAmount > 0) {
    cmd += left(`Descuento (${data.discountPct}%): -${data.currencySymbol}${data.discountAmount.toFixed(2)}`)
  }
  cmd += boldOn()
  cmd += doubleOn()
  cmd += left(`TOTAL: ${data.currencySymbol}${data.total.toFixed(2)}`)
  cmd += doubleOff()
  cmd += boldOff()
  
  // Pagos
  if (data.payments.length > 0) {
    cmd += dashed()
    cmd += left('Pagos:')
    for (const p of data.payments) {
      cmd += left(`  ${p.method.replace(/_/g, ' ')}: ${data.currencySymbol}${p.amount.toFixed(2)}`)
    }
  }
  
  cmd += dashed()
  
  // Footer
  if (data.footer) {
    cmd += center(data.footer)
  }
  cmd += center(`Emitido: ${new Date().toLocaleString('es-CU')}`)
  cmd += LF + LF + LF
  cmd += cut()
  
  return cmd
}

// Enviar comandos ESC/POS a impresora vía TCP desde el servidor
export async function sendToPrinter(ip: string, port: number, commands: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const net = await import('net')
    return new Promise((resolve) => {
      const socket = new net.Socket()
      socket.setTimeout(5000)
      socket.on('connect', () => {
        socket.write(Buffer.from(commands, 'latin1'))
        socket.end()
        resolve({ ok: true })
      })
      socket.on('timeout', () => {
        socket.destroy()
        resolve({ ok: false, error: 'Timeout al imprimir' })
      })
      socket.on('error', (err) => {
        socket.destroy()
        resolve({ ok: false, error: err.message })
      })
      socket.connect(port, ip)
    })
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
