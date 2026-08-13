// tests/integration/api.test.ts
// B: Tests de integración sin falsos verdes.
// B: Si falta un fixture, el test FALLA (no return).
// B: Asserts concretos (no [200,400,409]).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer, teardownServer, BASE_URL } from './setup'

let BASE = BASE_URL
let adminCookie = ''
let salonAreaId = ''
let productId = ''

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
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
  }
  if (body) opts.body = JSON.stringify(body)
  return fetch(`${BASE}${path}`, opts)
}

const maybeDescribe = process.env.SKIP_INTEGRATION === 'true' ? describe.skip : describe

maybeDescribe('Integration Tests', () => {
  beforeAll(async () => {
    BASE = await setupServer()
    adminCookie = await login('admin', 'admin123')
    // B: Si no hay cookie, FALLAR — no return
    expect(adminCookie).toBeTruthy()

    const areasRes = await api(adminCookie, 'GET', '/api/mesero/areas')
    const areasData = await areasRes.json()
    const salon = areasData.items?.find((a: any) => a.code === 'SALON')
    // B: Si no hay SALON, FALLAR
    expect(salon).toBeDefined()
    salonAreaId = salon.id
    expect(salonAreaId).toBeTruthy()

    const productsRes = await api(adminCookie, 'GET', `/api/mesero/products?areaId=${salonAreaId}`)
    const productsData = await productsRes.json()
    // B: Si no hay productos, FALLAR
    expect(productsData.items.length).toBeGreaterThan(0)
    productId = productsData.items[0].id
    expect(productId).toBeTruthy()
  }, 60000)

  afterAll(async () => {
    await teardownServer()
  })

  describe('Health', () => {
    it('GET /api/health devuelve 200 con ok=true', async () => {
      const res = await fetch(`${BASE}/api/health`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  describe('Auth', () => {
    it('login válido devuelve 200', async () => {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      })
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.user.username).toBe('admin')
    })

    it('login inválido devuelve 401', async () => {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrong' }),
      })
      expect(res.status).toBe(401)
    })

    it('GET /api/auth/me con cookie válida devuelve 200', async () => {
      const res = await api(adminCookie, 'GET', '/api/auth/me')
      expect(res.status).toBe(200)
    })

    it('GET /api/auth/me sin cookie devuelve 401', async () => {
      const res = await fetch(`${BASE}/api/auth/me`)
      expect(res.status).toBe(401)
    })
  })

  describe('Pedidos', () => {
    it('listar áreas devuelve 200 con items', async () => {
      const res = await api(adminCookie, 'GET', '/api/mesero/areas')
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.items.length).toBeGreaterThan(0)
    })

    it('listar productos devuelve 200 con items', async () => {
      const res = await api(adminCookie, 'GET', `/api/mesero/products?areaId=${salonAreaId}`)
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.items.length).toBeGreaterThan(0)
    })

    it('crear pedido devuelve 200', async () => {
      const res = await api(adminCookie, 'POST', '/api/mesero/orders', {
        areaId: salonAreaId,
        items: [{ productId, quantity: 1 }],
        sendToKitchen: false,
      })
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.item.number).toBeGreaterThan(0)
    })

    it('crear pedido sin items devuelve 400', async () => {
      const res = await api(adminCookie, 'POST', '/api/mesero/orders', {
        areaId: salonAreaId,
        items: [],
        sendToKitchen: false,
      })
      expect(res.status).toBe(400)
    })

    it('crear y cancelar pedido devuelve 200', async () => {
      const createRes = await api(adminCookie, 'POST', '/api/mesero/orders', {
        areaId: salonAreaId,
        items: [{ productId, quantity: 1 }],
        sendToKitchen: false,
      })
      const createData = await createRes.json()
      expect(createRes.status).toBe(200)
      const orderId = createData.item.id

      const cancelRes = await api(adminCookie, 'POST', `/api/mesero/orders/${orderId}/cancel`, {
        reason: 'Test',
      })
      expect(cancelRes.status).toBe(200)
    })
  })

  describe('Configuración pública', () => {
    it('GET /api/public/config devuelve 200 sin datos operacionales', async () => {
      const res = await fetch(`${BASE}/api/public/config`)
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.config.usdToCup).toBeUndefined()
      expect(data.config.offlineWifiName).toBeUndefined()
    })
  })

  describe('Cocina', () => {
    it('sin auth devuelve 401', async () => {
      const res = await fetch(`${BASE}/api/cocina/orders`)
      expect(res.status).toBe(401)
    })

    it('con admin devuelve 200', async () => {
      const res = await api(adminCookie, 'GET', '/api/cocina/orders')
      expect(res.status).toBe(200)
    })
  })

  describe('Pizzería', () => {
    it('sin auth devuelve 401', async () => {
      const res = await fetch(`${BASE}/api/pizzeria/orders`)
      expect(res.status).toBe(401)
    })

    it('con admin devuelve 200', async () => {
      const res = await api(adminCookie, 'GET', '/api/pizzeria/orders')
      expect(res.status).toBe(200)
    })
  })
})
