// ============================================================
// Mini servicio de tiempo real - Socket.IO (seguro)
// ============================================================
// Puerto: 3003 (configurado en Caddyfile para proxy)
//
// v1.0.19.2 (FASE 22-23 del roadmap):
//   - Token unificado a 5 partes: userId.role.expiresAt.authVersion.signature
//   - Compatibilidad con tokens legacy de 4 partes (authVersion=0)
//   - El servidor deriva áreas del rol, NO del cliente
//   - Eventos de negocio del cliente RECHAZADOS (solo el backend emite)
//   - Endpoint HTTP /emit para que el backend emita eventos
//   - Endpoint HTTP /health para health checks
//
// Arquitectura:
//   API → DB COMMIT → /api/internal/emit → este servicio → clientes
//   El cliente SOLO RECIBE. El servidor DECIDE y EMITE.
// ============================================================

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
// v1.0.20-rc-final: networkInterfaces removido — ya no se auto-descubren IPs locales.

const PORT = parseInt(process.env.REALTIME_PORT || '3003', 10)

// ============================================================
// Secreto de firma
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
// v1.0.19.2: UNIFICADO con src/lib/auth/token.ts
// Acepta 5 partes (userId.role.expiresAt.authVersion.signature)
// y 4 partes legacy (authVersion=0)
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
  authVersion: number
}

async function verifySessionToken(token: string): Promise<VerifiedSession | null> {
  try {
    const parts = token.split('.')
    // Aceptar 4 (legacy) y 5 (con authVersion)
    if (parts.length !== 4 && parts.length !== 5) return null

    const [userId, role, expiresAtStr, signatureOrAuthVer, maybeSignature] = parts

    let authVersion: number
    let signature: string
    let payload: string

    if (parts.length === 5) {
      // Formato unificado: userId.role.expiresAt.authVersion.signature
      authVersion = parseInt(signatureOrAuthVer, 10)
      signature = maybeSignature
      payload = `${userId}.${role}.${expiresAtStr}.${signatureOrAuthVer}`
    } else {
      // Legacy: userId.role.expiresAt.signature
      authVersion = 0
      signature = signatureOrAuthVer
      payload = `${userId}.${role}.${expiresAtStr}`
    }

    const expectedSig = await computeHmac(payload)
    if (signature !== expectedSig) return null

    const expiresAt = parseInt(expiresAtStr, 10)
    if (Date.now() > expiresAt) return null

    return { userId, role, expiresAt, authVersion }
  } catch {
    return null
  }
}

// ============================================================
// CORS
// ============================================================
// v1.0.20-rc-final: NO auto-incluir IPs de red local — si el servidor
// tiene IP pública (VPS, Cloud), quedaría CORS abierto a cualquier origen.
// Solo incluir localhost/127.0.0.1 en dev, y orígenes explícitos de env var.
function getAllowedOrigins(): string[] {
  const origins = new Set<string>()

  // En dev, permitir localhost
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
    origins.add('http://localhost')
    origins.add('http://127.0.0.1')
  }

  // Orígenes explícitos del env (CSV)
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    for (const o of envOrigins.split(',').map((s) => s.trim()).filter(Boolean)) {
      origins.add(o)
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[cors] ALLOWED_ORIGINS no configurado en producción. ' +
        'El realtime service rechazará conexiones desde orígenes no listados.',
    )
  }

  return Array.from(origins)
}

const ALLOWED_ORIGINS = getAllowedOrigins()
console.log('[cors] Orígenes permitidos:', ALLOWED_ORIGINS.join(', '))

// ============================================================
// Secreto compartido para endpoint /emit interno
// ============================================================
const INTERNAL_SECRET = process.env.REALTIME_SECRET || 'dev-internal-secret-change-in-prod'

// ============================================================
// Mapa rol → áreas permitidas
// El servidor deriva áreas del rol, NO del cliente.
// ============================================================
const ROLE_TO_AREAS: Record<string, string[]> = {
  ADMIN: [], // ADMIN se une a todas las áreas dinámicamente
  MESERO: [],
  MESERO_PRO: [],
  COCINA: [],
  PIZZERIA: [],
  CAJERO: [],
}

// ============================================================
// Tipos de salas y clientes
// ============================================================
interface ClientInfo {
  userId?: string
  role?: string
  authenticated: boolean
  authVersion: number
  connectedAt: number
}

const clients = new Map<string, ClientInfo>()

// ============================================================
// Validación de rooms
// ============================================================
function isValidRoom(room: string): boolean {
  if (!room || typeof room !== 'string') return false
  if (room === 'broadcast') return true
  if (room.startsWith('role:')) {
    const role = room.slice(5)
    return ['ADMIN', 'MESERO', 'MESERO_PRO', 'COCINA', 'PIZZERIA', 'CAJERO'].includes(role)
  }
  if (room.startsWith('user:')) {
    return room.slice(5).length > 0
  }
  if (room.startsWith('area:')) {
    return room.slice(5).length > 0
  }
  return false
}

// ============================================================
// Validación de payload por evento
// ============================================================
function validateEventPayload(event: string, data: any): { ok: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Payload vacío o inválido' }
  }
  switch (event) {
    case 'order:new':
      if (!data.orderId) return { ok: false, error: 'orderId requerido' }
      if (!data.areaId) return { ok: false, error: 'areaId requerido' }
      break
    case 'order:status':
      if (!data.orderId) return { ok: false, error: 'orderId requerido' }
      if (!data.status) return { ok: false, error: 'status requerido' }
      break
    case 'order:ready':
      if (!data.orderId) return { ok: false, error: 'orderId requerido' }
      break
    case 'payment:done':
      if (!data.orderId) return { ok: false, error: 'orderId requerido' }
      if (typeof data.amount !== 'number') return { ok: false, error: 'amount (number) requerido' }
      break
    case 'stock:low':
      if (!data.productId) return { ok: false, error: 'productId requerido' }
      break
    case 'notification':
      if (!data.title || !data.message) return { ok: false, error: 'title y message requeridos' }
      break
    case 'daily-close':
      if (!data.date) return { ok: false, error: 'date requerido' }
      break
    default:
      return { ok: false, error: `Evento no soportado: ${event}` }
  }
  return { ok: true }
}

// ============================================================
// Emisión interna (usada por el endpoint HTTP /emit)
// ============================================================
function emitToRoom(room: string, event: string, data: any): { ok: boolean; delivered: number } {
  if (room === 'broadcast') {
    io.emit(event, data)
    return { ok: true, delivered: io.engine.clientsCount }
  }
  io.to(room).emit(event, data)
  return { ok: true, delivered: -1 }
}

// ============================================================
// Servidor HTTP (endpoint /emit interno + health)
// ============================================================
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS para el endpoint HTTP
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Internal-Secret')
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Endpoint /emit: solo accesible desde localhost + secret
  if (req.url === '/emit' && req.method === 'POST') {
    const remoteIp =
      (req.headers['x-forwarded-for']?.toString().split(',')[0] || '').trim() ||
      req.socket.remoteAddress ||
      ''
    const isLocal =
      remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1' || remoteIp === ''

    if (!isLocal) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'FORBIDDEN: solo localhost' }))
      return
    }

    const secret = req.headers['x-internal-secret'] as string | undefined
    if (!secret || secret !== INTERNAL_SECRET) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'FORBIDDEN: secreto inválido' }))
      return
    }

    // Leer body
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 1_000_000) break
    }
    let parsed: any
    try {
      parsed = JSON.parse(body)
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'JSON inválido' }))
      return
    }

    const { room, event, data, clientOperationId } = parsed || {}
    if (typeof room !== 'string' || typeof event !== 'string' || typeof data !== 'object') {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Parámetros inválidos: { room, event, data }' }))
      return
    }

    if (!isValidRoom(room)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: `Sala inválida: ${room}` }))
      return
    }

    const validation = validateEventPayload(event, data)
    if (!validation.ok) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: `Payload inválido: ${validation.error}` }))
      return
    }

    const result = emitToRoom(room, event, data)
    console.log(`[emit] room=${room} event=${event} delivered=${result.delivered}`)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, delivered: result.delivered }))
    return
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      service: 'realtime',
      port: PORT,
      clients: clients.size,
      uptime: process.uptime(),
    }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'Not found' }))
})

// ============================================================
// Socket.IO server
// ============================================================
const io = new SocketIOServer(httpServer, {
  path: '/',
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
      console.warn(`[cors] Origen rechazado: ${origin}`)
      return callback(null, false)
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ============================================================
// Eventos del cliente que están PROHIBIDOS
// El cliente SOLO RECIBE. El servidor DECIDE y EMITE.
// ============================================================
const CLIENT_FORBIDDEN_EVENTS = [
  'order:new',
  'order:status',
  'order:ready',
  'payment:done',
  'stock:low',
  'notification',
  'daily-close',
  'message',
]

// ============================================================
// Conexión de sockets
// ============================================================
io.on('connection', (socket: Socket) => {
  console.log(`[+] ${socket.id} conectado`)
  clients.set(socket.id, { authenticated: false, authVersion: 0, connectedAt: Date.now() })

  // Autenticación: el cliente envía { token } en el handshake (auth.token)
  // o en el evento 'auth' posterior. El token se verifica y se extrae
  // userId/role del mismo. NO se confía en userId/role enviados por el cliente.
  //
  // v1.0.20-rc-final: NO aceptar token de query string — aparece en logs
  // de proxy, browser history y DevTools network tab. Solo auth.token.
  const tokenFromAuth = socket.handshake.auth?.token as string | undefined

  if (tokenFromAuth) {
    // Autenticación desde handshake (preferida)
    authenticateSocket(socket, tokenFromAuth)
  }

  // Evento 'auth' para autenticación posterior o reautenticación
  socket.on('auth', async (payload: { token?: string }) => {
    if (!payload || !payload.token) {
      socket.emit('auth:fail', { message: 'Token no proporcionado' })
      return
    }
    await authenticateSocket(socket, payload.token)
  })

  // Rechazar TODOS los eventos de negocio del cliente
  for (const ev of CLIENT_FORBIDDEN_EVENTS) {
    socket.on(ev, () => {
      console.warn(`[forbidden] ${socket.id} intentó emitir '${ev}' (rechazado)`)
      socket.emit('error', {
        message: `Los eventos de negocio solo pueden ser emitidos por el servidor.`,
        event: ev,
      })
    })
  }

  // Ping/Pong (utility, permitido)
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

// ============================================================
// Autenticar socket con token
// ============================================================
async function authenticateSocket(socket: Socket, token: string) {
  const session = await verifySessionToken(token)
  if (!session) {
    console.warn(`[auth] ${socket.id} token inválido o expirado`)
    socket.emit('auth:fail', { message: 'Token inválido o expirado' })
    return
  }

  const info: ClientInfo = {
    userId: session.userId,
    role: session.role,
    authenticated: true,
    authVersion: session.authVersion,
    connectedAt: Date.now(),
  }
  clients.set(socket.id, info)

  // Unir a salas basadas en el ROL (derivado del token, NO del cliente)
  socket.join(`role:${session.role}`)
  socket.join(`user:${session.userId}`)

  // ADMIN se une a todas las salas de rol
  if (session.role === 'ADMIN') {
    for (const role of ['MESERO', 'MESERO_PRO', 'COCINA', 'PIZZERIA', 'CAJERO']) {
      socket.join(`role:${role}`)
    }
  }

  console.log(
    `[auth] ${socket.id} → user=${session.userId} role=${session.role} authVersion=${session.authVersion}`,
  )
  socket.emit('auth:ok', {
    userId: session.userId,
    role: session.role,
    authVersion: session.authVersion,
  })
}

// ============================================================
// Iniciar servidor
// ============================================================
httpServer.listen(PORT, () => {
  console.log(`🔌 Realtime service corriendo en puerto ${PORT}`)
  console.log(`   Endpoint HTTP interno: POST http://localhost:${PORT}/emit (localhost + secret)`)
  console.log(`   Health check: GET http://localhost:${PORT}/health`)
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

process.on('SIGINT', () => {
  console.log('Cerrando servidor...')
  io.close(() => {
    httpServer.close(() => {
      process.exit(0)
    })
  })
})

export { verifySessionToken, validateEventPayload, isValidRoom }
