// ============================================================
// Mini servicio de tiempo real - Socket.IO
// ============================================================
// Puerto: 3003 (configurado en Caddyfile para proxy)
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

const PORT = 3003

const httpServer = createServer()
const io = new SocketIOServer(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
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
}

const clients = new Map<string, ClientInfo>()

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} conectado`)

  // Guardar info del cliente
  clients.set(socket.id, {})

  // Autenticación del socket
  socket.on('auth', (payload: { userId: string; role: string; areaId?: string }) => {
    if (!payload || !payload.userId || !payload.role) {
      socket.emit('error', { message: 'Auth payload inválido' })
      return
    }
    clients.set(socket.id, payload)
    socket.join(`role:${payload.role}`)
    socket.join(`user:${payload.userId}`)
    if (payload.areaId) {
      socket.join(`area:${payload.areaId}`)
    }
    console.log(`[auth] ${socket.id} → user=${payload.userId} role=${payload.role}`)
    socket.emit('auth:ok', { userId: payload.userId, role: payload.role })
  })

  // === Eventos de pedidos ===

  // Nuevo pedido creado por mesero
  socket.on('order:new', (data: { orderId: string; userId: string; areaId: string; tableId?: string; items: any[] }) => {
    console.log(`[order:new] order=${data.orderId} area=${data.areaId}`)
    // Notificar a cocina/pizzeria del área correspondiente
    io.to(`area:${data.areaId}`).emit('order:new', data)
    // También notificar a admin
    io.to('role:ADMIN').emit('order:new', data)
  })

  // Cambio de estado del pedido (de cocina)
  socket.on('order:status', (data: { orderId: string; status: string; userId: string }) => {
    console.log(`[order:status] order=${data.orderId} status=${data.status}`)
    // Notificar al mesero dueño del pedido
    io.to(`user:${data.userId}`).emit('order:status', data)
    // Notificar a admin
    io.to('role:ADMIN').emit('order:status', data)
  })

  // Pedido listo (sonido + vibración al mesero)
  socket.on('order:ready', (data: { orderId: string; userId: string; orderNumber: number }) => {
    console.log(`[order:ready] order=${data.orderId}`)
    io.to(`user:${data.userId}`).emit('order:ready', data)
    io.to('role:ADMIN').emit('order:ready', data)
  })

  // Cobro registrado
  socket.on('payment:done', (data: { orderId: string; userId: string; amount: number }) => {
    console.log(`[payment:done] order=${data.orderId} amount=${data.amount}`)
    io.to('role:ADMIN').emit('payment:done', data)
    io.to('role:CAJERO').emit('payment:done', data)
  })

  // === Stock ===
  socket.on('stock:low', (data: { productId: string; productName: string; areaId?: string }) => {
    console.log(`[stock:low] product=${data.productName}`)
    io.to('role:ADMIN').emit('stock:low', data)
    if (data.areaId) {
      io.to(`area:${data.areaId}`).emit('stock:low', data)
    }
  })

  // === Notificaciones ===
  socket.on('notification', (data: { userId?: string; role?: string; title: string; message: string; type?: string }) => {
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
    console.log(`[daily-close] date=${data.date} status=${data.status}`)
    io.emit('daily-close', data)
  })

  // === Mensajería interna ===
  socket.on('message', (data: { to: string; from: string; message: string }) => {
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
