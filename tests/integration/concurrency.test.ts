// tests/integration/concurrency.test.ts
// B: Tests de concurrencia con asserts concretos.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer, teardownServer, BASE_URL } from './setup'

let BASE = BASE_URL
let cookie = ''
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

maybeDescribe('Concurrency Tests', () => {
  beforeAll(async () => {
    BASE = await setupServer()
    cookie = await login('admin', 'admin123')
    expect(cookie).toBeTruthy()

    const areasRes = await api(cookie, 'GET', '/api/mesero/areas')
    const areasData = await areasRes.json()
    const salon = areasData.items?.find((a: any) => a.code === 'SALON')
    expect(salon).toBeDefined()
    salonAreaId = salon.id

    const productsRes = await api(cookie, 'GET', `/api/mesero/products?areaId=${salonAreaId}`)
    const productsData = await productsRes.json()
    expect(productsData.items.length).toBeGreaterThan(0)
    productId = productsData.items[0].id
  }, 60000)

  afterAll(async () => {
    await teardownServer()
  })

  it('dos pedidos simultáneos tienen números diferentes con diff=1', async () => {
    const [res1, res2] = await Promise.all([
      api(cookie, 'POST', '/api/mesero/orders', {
        areaId: salonAreaId, items: [{ productId, quantity: 1 }], sendToKitchen: false,
      }),
      api(cookie, 'POST', '/api/mesero/orders', {
        areaId: salonAreaId, items: [{ productId, quantity: 2 }], sendToKitchen: false,
      }),
    ])
    const data1 = await res1.json()
    const data2 = await res2.json()
    expect(data1.ok).toBe(true)
    expect(data2.ok).toBe(true)
    expect(data1.item.number).not.toBe(data2.item.number)
    expect(Math.abs(data1.item.number - data2.item.number)).toBe(1)
  })

  it('pago con idempotencyKey: segundo pago no duplica', async () => {
    const createRes = await api(cookie, 'POST', '/api/mesero/orders', {
      areaId: salonAreaId, items: [{ productId, quantity: 1 }], sendToKitchen: false,
    })
    const createData = await createRes.json()
    expect(createData.ok).toBe(true)
    const orderId = createData.item.id
    const total = createData.item.total
    const key = `test-idem-${Date.now()}`

    const payRes1 = await api(cookie, 'POST', `/api/mesero/orders/${orderId}/pay`, {
      payments: [{ method: 'EFECTIVO_CUP', amount: total }],
      idempotencyKey: key,
    })

    if (payRes1.status === 200) {
      // Producto DIRECTO: pago exitoso
      // Segundo pago con mismo key → debe ser idempotente (200 con idempotent=true)
      const payRes2 = await api(cookie, 'POST', `/api/mesero/orders/${orderId}/pay`, {
        payments: [{ method: 'EFECTIVO_CUP', amount: total }],
        idempotencyKey: key,
      })
      expect(payRes2.status).toBe(200)
      const payData2 = await payRes2.json()
      expect(payData2.idempotent).toBe(true)
    } else {
      // Producto FINAL: no se puede cobrar (items pendientes)
      expect(payRes1.status).toBe(400)
      const payData1 = await payRes1.json()
      expect(payData1.error).toContain('listos')
    }
  })
})
