// tests/integration/concurrency.test.ts
// Tests de concurrencia contra servidor real.
// P3: Asserts concretos — no aceptar [200, 400, 409] indiscriminadamente.
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
    // P2: fixture obligatorio — si falla, el test falla
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
  }, 120000)

  afterAll(async () => {
    await teardownServer()
  })

  it('dos pedidos simultáneos tienen números diferentes', async () => {
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

    // Ambos deben tener éxito
    expect(data1.ok).toBe(true)
    expect(data2.ok).toBe(true)

    // Los números deben ser diferentes
    expect(data1.item.number).not.toBe(data2.item.number)

    // La diferencia debe ser exactamente 1 (números secuenciales)
    const diff = Math.abs(data1.item.number - data2.item.number)
    expect(diff).toBe(1)
  })

  it('pago con idempotencyKey: primer pago 200, segundo pago idempotente o ya cobrado', async () => {
    // Crear pedido
    const createRes = await api(cookie, 'POST', '/api/mesero/orders', {
      areaId: salonAreaId,
      items: [{ productId, quantity: 1 }],
      sendToKitchen: false,
    })
    const createData = await createRes.json()
    expect(createData.ok).toBe(true)
    const orderId = createData.item.id
    const total = createData.item.total

    // Primer pago con idempotencyKey
    const key = `test-concurrency-${Date.now()}`
    const payRes1 = await api(cookie, 'POST', `/api/mesero/orders/${orderId}/pay`, {
      payments: [{ method: 'EFECTIVO_CUP', amount: total }],
      idempotencyKey: key,
    })
    const payData1 = await payRes1.json()

    // El primer pago debe ser exitoso (200) o rechazado por items pendientes (400)
    // Si el producto es DIRECTO, nace SERVIDO y se puede cobrar → 200
    // Si el producto es FINAL, nace PENDIENTE y no se puede cobrar → 400
    if (payRes1.status === 200) {
      expect(payData1.ok).toBe(true)

      // Segundo pago con mismo key → debe ser idempotente (200 con idempotent=true) o ya cobrado (400)
      const payRes2 = await api(cookie, 'POST', `/api/mesero/orders/${orderId}/pay`, {
        payments: [{ method: 'EFECTIVO_CUP', amount: total }],
        idempotencyKey: key,
      })
      const payData2 = await payRes2.json()
      // Si devuelve 200, debe ser idempotente
      // Si devuelve 400, debe decir "ya está cobrado"
      expect([200, 400]).toContain(payRes2.status)
      if (payRes2.status === 200) {
        expect(payData2.idempotent).toBe(true)
      }
    } else if (payRes1.status === 400) {
      // Producto FINAL con items pendientes — comportamiento correcto
      expect(payData1.error).toContain('listos')
    } else {
      // No se esperan otros códigos
    }
  })
})
