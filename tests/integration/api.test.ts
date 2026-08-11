import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const BASE = 'http://localhost:3000'

let cookieHeader = ''
let meseroCookie = ''
let adminCookie = ''

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const setCookie = res.headers.get('set-cookie') || ''
  const match = setCookie.match(/rc_session=([^;]+)/)
  return match ? `rc_session=${match[1]}` : ''
}

async function api(cookie: string, method: string, path: string, body?: any) {
  const opts: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  }
  if (body) opts.body = JSON.stringify(body)
  return fetch(`${BASE}${path}`, opts)
}

describe('Integration Tests', () => {
  beforeAll(async () => {
    adminCookie = await login('admin', 'admin123')
    meseroCookie = await login('mesero', 'mesero123')
    expect(adminCookie).toBeTruthy()
    expect(meseroCookie).toBeTruthy()
  })

  describe('Health Check', () => {
    it('GET /api/health responde con estado', async () => {
      const res = await fetch(`${BASE}/api/health`)
      const data = await res.json()
      expect(data.status).toMatch(/healthy|degraded/)
      expect(data.uptime).toBeGreaterThan(0)
      expect(data.checks.database.status).toBe('ok')
    })
  })

  describe('Autenticación', () => {
    it('POST /api/auth/login con credenciales válidas', async () => {
      const cookie = await login('admin', 'admin123')
      expect(cookie).toContain('rc_session=')
    })

    it('POST /api/auth/login con credenciales inválidas', async () => {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrong' }),
      })
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(res.status).toBe(401)
    })

    it('GET /api/auth/me devuelve usuario actual', async () => {
      const res = await api(adminCookie, 'GET', '/api/auth/me')
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.user.username).toBe('admin')
      expect(data.user.role).toBe('ADMIN')
    })

    it('GET /api/auth/me sin cookie devuelve user null', async () => {
      const res = await fetch(`${BASE}/api/auth/me`)
      const data = await res.json()
      expect(data.user).toBeNull()
    })
  })

  describe('Control de acceso por rol', () => {
    it('mesero no puede acceder a /api/admin/usuarios', async () => {
      const res = await api(meseroCookie, 'GET', '/api/admin/usuarios')
      expect(res.status).toBe(403)
    })

    it('mesero no puede acceder a /api/admin/finanzas/summary', async () => {
      const res = await api(meseroCookie, 'GET', '/api/admin/finanzas/summary')
      expect(res.status).toBe(403)
    })

    it('cocina no puede acceder a /api/mesero/orders', async () => {
      const cocinaCookie = await login('cocina', 'cocina123')
      const res = await api(cocinaCookie, 'GET', '/api/mesero/orders')
      expect(res.status).toBe(403)
    })

    it('admin puede acceder a todo', async () => {
      const res1 = await api(adminCookie, 'GET', '/api/admin/usuarios')
      expect(res1.status).toBe(200)
      const res2 = await api(adminCookie, 'GET', '/api/admin/finanzas/summary')
      expect(res2.status).toBe(200)
    })
  })

  describe('Flujo de pedidos', () => {
    let orderId: string

    it('mesero puede listar productos', async () => {
      const res = await api(meseroCookie, 'GET', '/api/mesero/products')
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)
    })

    it('mesero puede listar áreas', async () => {
      const res = await api(meseroCookie, 'GET', '/api/mesero/areas')
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)
    })

    it('mesero puede crear pedido', async () => {
      // Buscar área SALON
      const areasRes = await api(meseroCookie, 'GET', '/api/mesero/areas')
      const areasData = await areasRes.json()
      const salonArea = areasData.items.find((a: any) => a.code === 'SALON')

      // Buscar productos
      const prodsRes = await api(meseroCookie, 'GET', `/api/mesero/products?areaId=${salonArea.id}`)
      const prodsData = await prodsRes.json()

      const res = await api(meseroCookie, 'POST', '/api/mesero/orders', {
        areaId: salonArea.id,
        items: [
          { productId: prodsData.items[0].id, quantity: 1 },
        ],
        sendToKitchen: false,
      })
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.item.number).toBeGreaterThan(1000)
      orderId = data.item.id
    })

    it('mesero puede ver su pedido', async () => {
      if (!orderId) return
      const res = await api(meseroCookie, 'GET', `/api/mesero/orders/${orderId}`)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.item.id).toBe(orderId)
    })

    it('mesero puede añadir item al pedido', async () => {
      if (!orderId) return
      const prodsRes = await api(meseroCookie, 'GET', '/api/mesero/products')
      const prodsData = await prodsRes.json()
      const res = await api(meseroCookie, 'POST', `/api/mesero/orders/${orderId}/items`, {
        productId: prodsData.items[1]?.id || prodsData.items[0].id,
        quantity: 2,
      })
      const data = await res.json()
      expect(data.ok).toBe(true)
    })

    it('no se puede cobrar con items pendientes', async () => {
      if (!orderId) return
      const res = await api(meseroCookie, 'POST', `/api/mesero/orders/${orderId}/pay`, {
        payments: [{ method: 'EFECTIVO_CUP', amount: 999, currency: 'CUP' }],
      })
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(data.error).toContain('no están listos')
    })

    it('mesero puede cancelar pedido', async () => {
      if (!orderId) return
      const res = await api(meseroCookie, 'POST', `/api/mesero/orders/${orderId}/cancel`, {
        reason: 'Test de cancelación',
      })
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.item.status).toBe('CANCELADO')
    })
  })

  describe('Dashboard del admin', () => {
    it('admin puede ver dashboard', async () => {
      const res = await api(adminCookie, 'GET', '/api/admin/dashboard')
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.stats).toBeDefined()
      expect(data.stats.totalUsers).toBeGreaterThan(0)
    })
  })

  describe('Export', () => {
    it('admin puede exportar pedidos a Excel', async () => {
      const res = await api(adminCookie, 'GET', '/api/admin/export?type=excel&data=orders')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-disposition')).toContain('attachment')
    })

    it('admin puede exportar finanzas a PDF', async () => {
      const res = await api(adminCookie, 'GET', '/api/admin/export?type=pdf&data=finances')
      expect(res.status).toBe(200)
    })
  })

  describe('Backups', () => {
    it('admin puede crear backup', async () => {
      const res = await api(adminCookie, 'POST', '/api/admin/respaldos', {})
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.item.filename).toBeDefined()
      expect(data.item.checksum).toBeDefined()
    })
  })

  describe('Turnos', () => {
    it('admin puede ver turno actual', async () => {
      const res = await api(adminCookie, 'GET', '/api/admin/turnos/current')
      expect(res.status).toBe(200)
    })
  })
})
