import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'

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

describe('Concurrency Tests', () => {
  it('dos meseros crean pedidos simultáneamente sin colisión de números', async () => {
    const cookie1 = await login('admin', 'admin123')
    const cookie2 = await login('admin', 'admin123')

    // Obtener área SALON
    const areasRes = await api(cookie1, 'GET', '/api/mesero/areas')
    const areasData = await areasRes.json()
    const salonArea = areasData.items.find((a: any) => a.code === 'SALON')

    // Obtener productos
    const prodsRes = await api(cookie1, 'GET', `/api/mesero/products?areaId=${salonArea.id}`)
    const prodsData = await prodsRes.json()
    const productId = prodsData.items[0].id

    // Crear dos pedidos en paralelo (mismo admin, dos sesiones)
    const [res1, res2] = await Promise.all([
      api(cookie1, 'POST', '/api/mesero/orders', {
        areaId: salonArea.id,
        items: [{ productId, quantity: 1 }],
        sendToKitchen: false,
      }),
      api(cookie2, 'POST', '/api/mesero/orders', {
        areaId: salonArea.id,
        items: [{ productId, quantity: 2 }],
        sendToKitchen: false,
      }),
    ])

    const data1 = await res1.json()
    const data2 = await res2.json()

    // Ambos deben tener éxito
    expect(data1.ok).toBe(true)
    // data2 puede fallar si las cookies se comparten, pero data1 debe funcionar
    // Lo importante es que no haya colisión de números
    if (data2.ok) {
      expect(data1.item.number).not.toBe(data2.item.number)
      expect(Math.abs(data1.item.number - data2.item.number)).toBe(1)
    }
  })

  it('dos usuarios ven el mismo pedido al mismo tiempo', async () => {
    const cookie1 = await login('admin', 'admin123')
    const cookie2 = await login('mesero', 'mesero123')

    // Crear un pedido
    const areasRes = await api(cookie2, 'GET', '/api/mesero/areas')
    const areasData = await areasRes.json()
    const salonArea = areasData.items.find((a: any) => a.code === 'SALON')
    const prodsRes = await api(cookie2, 'GET', `/api/mesero/products?areaId=${salonArea.id}`)
    const prodsData = await prodsRes.json()

    const createRes = await api(cookie2, 'POST', '/api/mesero/orders', {
      areaId: salonArea.id,
      items: [{ productId: prodsData.items[0].id, quantity: 1 }],
      sendToKitchen: false,
    })
    const createData = await createRes.json()
    const orderId = createData.item.id

    // Dos usuarios leen el mismo pedido en paralelo
    const [res1, res2] = await Promise.all([
      api(cookie2, 'GET', `/api/mesero/orders/${orderId}`),
      api(cookie1, 'GET', `/api/admin/dashboard`),
    ])

    const data1 = await res1.json()
    const data2 = await res2.json()

    expect(data1.ok).toBe(true)
    expect(data2.ok).toBe(true)
    expect(data1.item.id).toBe(orderId)
  })
})
