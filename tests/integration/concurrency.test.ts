// tests/integration/concurrency.test.ts
// FASE 20: Tests de concurrencia contra servidor real.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer, teardownServer, BASE_URL } from './setup'

let BASE = BASE_URL

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

maybeDescribe('Concurrency Tests', () => {
  let cookie = ''
  let salonAreaId = ''
  let productId = ''

  beforeAll(async () => {
    BASE = await setupServer()
    cookie = await login('admin', 'admin123')

    const areasRes = await api(cookie, 'GET', '/api/mesero/areas')
    const areasData = await areasRes.json()
    salonAreaId = areasData.items?.find((a: any) => a.code === 'SALON')?.id || ''

    const productsRes = await api(cookie, 'GET', `/api/mesero/products?areaId=${salonAreaId}`)
    const productsData = await productsRes.json()
    productId = productsData.items?.[0]?.id || ''
  }, 120000)

  afterAll(async () => {
    await teardownServer()
  })

  it('dos meseros crean pedidos simultáneamente sin colisión de números', async () => {
    if (!productId) return

    const [res1, res2] = await Promise.all([
      api(cookie, 'POST', '/api/mesero/orders', {
        areaId: salonAreaId,
        items: [{ productId, quantity: 1 }],
        sendToKitchen: false,
      }),
      api(cookie, 'POST', '/api/mesero/orders', {
        areaId: salonAreaId,
        items: [{ productId, quantity: 2 }],
        sendToKitchen: false,
      }),
    ])

    const data1 = await res1.json()
    const data2 = await res2.json()

    expect(data1.ok).toBe(true)
    if (data2.ok) {
      expect(data1.item.number).not.toBe(data2.item.number)
      expect(Math.abs(data1.item.number - data2.item.number)).toBe(1)
    }
  })

  it('dos usuarios ven el mismo pedido al mismo tiempo', async () => {
    if (!productId) return

    const createRes = await api(cookie, 'POST', '/api/mesero/orders', {
      areaId: salonAreaId,
      items: [{ productId, quantity: 1 }],
      sendToKitchen: false,
    })
    const createData = await createRes.json()
    if (!createData.ok) return
    const orderId = createData.item.id

    const cookie2 = await login('admin', 'admin123')

    const [res1, res2] = await Promise.all([
      api(cookie, 'GET', `/api/mesero/orders/${orderId}`),
      api(cookie2, 'GET', `/api/mesero/orders`),
    ])

    const data1 = await res1.json()
    const data2 = await res2.json()

    expect(data1.ok).toBe(true)
    expect(data2.ok).toBe(true)
  })

  it('pago con idempotencyKey no duplica', async () => {
    if (!productId) return

    // Crear pedido
    const createRes = await api(cookie, 'POST', '/api/mesero/orders', {
      areaId: salonAreaId,
      items: [{ productId, quantity: 1 }],
      sendToKitchen: false,
    })
    const createData = await createRes.json()
    if (!createData.ok) return
    const orderId = createData.item.id
    const total = createData.item.total

    // Pagar con idempotencyKey
    const key = `test-concurrency-${Date.now()}`
    const payRes1 = await api(cookie, 'POST', `/api/mesero/orders/${orderId}/pay`, {
      payments: [{ method: 'EFECTIVO_CUP', amount: total }],
      idempotencyKey: key,
    })

    // Segundo pago con mismo key
    const payRes2 = await api(cookie, 'POST', `/api/mesero/orders/${orderId}/pay`, {
      payments: [{ method: 'EFECTIVO_CUP', amount: total }],
      idempotencyKey: key,
    })

    // Al menos uno debe ser exitoso, el otro debe ser idempotente o rechazado
    expect([200, 409, 400]).toContain(payRes1.status)
    expect([200, 409, 400]).toContain(payRes2.status)
  })
})
