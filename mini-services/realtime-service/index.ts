// ============================================================
// Mini servicio de tiempo real - Socket.IO (seguro)
// ============================================================
// Puerto: 3003 (configurado en Caddyfile para proxy)
//
// Seguridad (FIX 8):
//   - El cliente envía unicamente { token, areaId? } en el evento 'auth'.
//   - El token se verifica con la MISMA función HMAC SHA-256 que el
//     middleware de Next.js (Web Crypto API).
//   - userId y role se extraen del token verificado. NUNCA se confía
//     en userId/role enviados directamente por el cliente.
//   - Si el token es inválido o ha expirado, se rechaza la conexión.
//
// CORS (FIX 11):
//   - Lista de orígenes permitidos configurable.
//   - Por defecto: localhost, 127.0.0.1 e IP del servidor.
//   - Variable de entorno ALLOWED_ORIGINS (CSV) para añadir más.
//
// Eventos soportados:
//   - order:new          (a cocina/pizzería)
//   - order:status       (a mesero)
//   - order:ready        (a mesero)
//   - stock:low          (broadcast)
//   - notification       (a usuario específico)
//   - daily-close        (broadcast)
// ============================================================

import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { networkInterfaces } from 'os'

const PORT = 3003
const SESSION_COOKIE = 'rc_session'

// ============================================================
// Secreto de firma (FIX 9):
//   - En production: debe venir de NEXTAUTH_SECRET (error si falta).
//   - En development: fallback a un valor por defecto (solo tests).
// ============================================================
function getSecret(): string {
  const envSecret = process.env.NEXTAUTH_SECRET
  if (envSecret && envSecret.length >= 16) return envSecret
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXTAUTH_SECRET no configurado. En producción es obligatorio definir NEXTAUTH_SECRET (>= 16 chars).',
    )
  }
  return 'cuba-restaurante-secret-key-change-in-prod'
}

const SECRET = getSecret()

// ============================================================
// Verificación de token HMAC SHA-256 (Web Crypto API).
// Réplica exacta de src/lib/auth/token.ts para usar el mismo algoritmo.
// ============================================================
function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function computeHmac(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const keyData = enc.encode(SECRET)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return bytesToHex(sig)
}

interface VerifiedSession {
  userId: string
  role: string
  expiresAt: number
}

async function verifySessionToken(token: string): Promise<VerifiedSession | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 4) return null
    const [userId, role, expiresAtStr, signature] = parts
    const payload = `${userId}.${role}.${expiresAtStr}`
    const expectedSig = await computeHmac(payload)
    if (signature !== expectedSig) return null

    const expiresAt = parseInt(expiresAtStr, 10)
    if (Date.now() > expiresAt) return null

    return { userId, role, expiresAt }
  } catch {
    return null
  }
}

// ============================================================
// CORS (FIX 11): Lista de orígenes permitidos.
// ============================================================
function getAllowedOrigins(): string[] {
  const origins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost',
    'http://127.0.0.1',
  ])

  // IP(s) del servidor detectadas dinámicamente
  try {
    const nets = networkInterfaces()
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          origins.add(`http://${net.address}:3000`)
          origins.add(`http://${net.address}`)
        }
      }
    }
  } catch {
    // Ignorar errores al detectar IP
  }

  // Variable de entorno: lista CSV
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    for (const o of envOrigins.split(',').map((s) => s.trim()).filter(Boolean)) {
      origins.add(o)
    }
  }

  return Array.from(origins)
}

const ALLOWED_ORIGINS = getAllowedOrigins()
console.log('[cors] Orígenes permitidos:', ALLOWED_ORIGINS.join(', '))

const httpServer = createServer()
const io = new SocketIOServer(httpServer, {
  path: '/',
  cors: {
    origin: (origin, callback) => {
      // Permitir peticiones sin origin (mismo host / curl / Postman)
      if (!origin) return callback(null, true)
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true)
      }
      console.warn(`[cors] Origen rechazado: ${origin}`)
      return callback(null, false)
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Tipos de salas
// - role:admin, role:mesero, role:cocina, role:pizzeria, role:cajero
// - user:<userId>
// - area:<areaId>

interface ClientInfo {
  userId?: string
  role?: string
  areaId?: string
  authenticated: boolean
}

const clients = new Map<string, ClientInfo>()

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} conectado`)
  clients.set(socket.id, { authenticated: false })

  // ============================================================
  // Autenticación del socket (FIX 8):
  //   El cliente envía { token, areaId? }.
  //   Verificamos el token y extraemos userId/role firmados.
  //   Rechazamos si el token es inválido o ha expirado.
  // ============================================================
  socket.on('auth', async (payload: { token?: string; areaId?: string }) => {
    if (!payload || !payload.token) {
      socket.emit('auth:fail', { message: 'Token no proporcionado' })
      return
    }

    const session = await verifySessionToken(payload.token)
    if (!session) {
      console.warn(`[auth] ${socket.id} token inválido o expirado`)
      socket.emit('auth:fail', { message: 'Token inválido o expirado' })
      // No desconectamos inmediatamente para que el cliente pueda reintentar
      // (reautenticación tras refresh), pero marcamos como no autenticado.
      return
    }

    const info: ClientInfo = {
      userId: session.userId,
      role: session.role,
      areaId: payload.areaId,
      authenticated: true,
    }
    clients.set(socket.id, info)
    socket.join(`role:${session.role}`)
    socket.join(`user:${session.userId}`)
    if (payload.areaId) {
      socket.join(`area:${payload.areaId}`)
    }
    console.log(
      `[auth] ${socket.id} → user=${session.userId} role=${session.role} areaId=${payload.areaId || '-'}`,
    )
    socket.emit('auth:ok', { userId: session.userId, role: session.role })
  })

  // ============================================================
  // Verificación de autenticación para eventos sensibles
  // ============================================================
  function requireAuth(): ClientInfo | null {
    const info = clients.get(socket.id)
    if (!info || !info.authenticated || !info.userId || !info.role) return null
    return info
  }

  // === Eventos de pedidos ===

  // Nuevo pedido creado por mesero
  socket.on('order:new', (data: { orderId: string; userId: string; areaId: string; tableId?: string; items: any[] }) => {
    if (!requireAuth()) {
      socket.emit('error', { message: 'No autenticado' })
      return
    }
    console.log(`[order:new] order=${data.orderId} area=${data.areaId}`)
    io.to(`area:${data.areaId}`).emit('order:new', data)
    io.to('role:ADMIN').emit('order:new', data)
  })

  // Cambio de estado del pedido (de cocina)
  socket.on('order:status', (data: { orderId: string; status: string; userId: string }) => {
    if (!requireAuth()) {
      socket.emit('error', { message: 'No autenticado' })
      return
    }
    console.log(`[order:status] order=${data.orderId} status=${data.status}`)
    io.to(`user:${data.userId}`).emit('order:status', data)
    io.to('role:ADMIN').emit('order:status', data)
  })

  // Pedido listo (sonido + vibración al mesero)
  socket.on('order:ready', (data: { orderId: string; userId: string; orderNumber: number }) => {
    if (!requireAuth()) {
      socket.emit('error', { message: 'No autenticado' })
      return
    }
    console.log(`[order:ready] order=${data.orderId}`)
    io.to(`user:${data.userId}`).emit('order:ready', data)
    io.to('role:ADMIN').emit('order:ready', data)
  })

  // Cobro registrado
  socket.on('payment:done', (data: { orderId: string; userId: string; amount: number }) => {
    if (!requireAuth()) {
      socket.emit('error', { message: 'No autenticado' })
      return
    }
    console.log(`[payment:done] order=${data.orderId} amount=${data.amount}`)
    io.to('role:ADMIN').emit('payment:done', data)
    io.to('role:CAJERO').emit('payment:done', data)
  })

  // === Stock ===
  socket.on('stock:low', (data: { productId: string; productName: string; areaId?: string }) => {
    if (!requireAuth()) {
      socket.emit('error', { message: 'No autenticado' })
      return
    }
    console.log(`[stock:low] product=${data.productName}`)
    io.to('role:ADMIN').emit('stock:low', data)
    if (data.areaId) {
      io.to(`area:${data.areaId}`).emit('stock:low', data)
    }
  })

  // === Notificaciones ===
  socket.on('notification', (data: { userId?: string; role?: string; title: string; message: string; type?: string }) => {
    if (!requireAuth()) {
      socket.emit('error', { message: 'No autenticado' })
      return
    }
    if (data.userId) {
      io.to(`user:${data.userId}`).emit('notification', data)
    } else if (data.role) {
      io.to(`role:${data.role}`).emit('notification', data)
    } else {
      io.emit('notification', data)
    }
  })

  // === Cierre diario ===
  socket.on('daily-close', (data: { date: string; status: string; total?: number }) => {
    if (!requireAuth()) {
      socket.emit('error', { message: 'No autenticado' })
      return
    }
    console.log(`[daily-close] date=${data.date} status=${data.status}`)
    io.emit('daily-close', data)
  })

  // === Mensajería interna ===
  socket.on('message', (data: { to: string; from: string; message: string }) => {
    if (!requireAuth()) {
      socket.emit('error', { message: 'No autenticado' })
      return
    }
    io.to(`user:${data.to}`).emit('message', data)
  })

  // === Ping/Pong ===
  socket.on('ping', () => {
    socket.emit('pong', { time: Date.now() })
  })

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} desconectado`)
    clients.delete(socket.id)
  })

  socket.on('error', (err) => {
    console.error(`[error] ${socket.id}:`, err)
  })
})

httpServer.listen(PORT, () => {
  console.log(`🔌 Realtime service corriendo en puerto ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Cerrando servidor...')
  io.close(() => {
    httpServer.close(() => {
      process.exit(0)
    })
  })
})
