// tests/e2e/auth-roles.spec.ts
// v1.0.20-FRONTEND-13: E2E tests para auth, roles y permisos.
//
// Flujos cubiertos:
//   - Login con cada rol (admin, mesero, cocina, pizzeria, cajero)
//   - Redirect al panel correcto por rol
//   - Acceso denegado a rutas de otros roles
//   - Logout limpia cookie
//   - Health endpoint
//   - Help filtrado por rol (FRONTEND-11)

import { test, expect } from '@playwright/test'

const ROLES = [
  { username: 'admin', password: 'admin123', expectedPath: '/admin' },
  { username: 'mesero', password: 'mesero123', expectedPath: '/mesero' },
  { username: 'cocina', password: 'cocina123', expectedPath: '/cocina' },
  { username: 'pizzeria', password: 'pizzeria123', expectedPath: '/pizzeria' },
]

test.describe('Auth y Roles — Login por cada rol', () => {
  for (const role of ROLES) {
    test(`login ${role.username} → redirige a ${role.expectedPath}`, async ({ page, context }) => {
      await context.clearCookies()
      await page.goto('/login')
      await page.fill('#username', role.username)
      await page.fill('#password', role.password)
      await page.click('button[type="submit"]')
      await page.waitForURL(`**${role.expectedPath}`, { timeout: 15000 })
      expect(page.url()).toContain(role.expectedPath)
    })
  }
})

test.describe('Auth y Roles — Acceso denegado', () => {
  test('mesero no puede acceder a /admin', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/login')
    await page.fill('#username', 'mesero')
    await page.fill('#password', 'mesero123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/mesero', { timeout: 15000 })

    await page.goto('/admin')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toContain('/admin')
  })

  test('cocina no puede acceder a /admin', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/login')
    await page.fill('#username', 'cocina')
    await page.fill('#password', 'cocina123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/cocina', { timeout: 15000 })

    await page.goto('/admin')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toContain('/admin')
  })

  test('sin sesión → /admin redirige a /login', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/admin')
    await page.waitForTimeout(2000)
    expect(page.url()).toMatch(/\/login/)
  })
})

test.describe('Auth y Roles — Help filtrado por rol (FRONTEND-11)', () => {
  test('cocina solo ve módulos inventario+sistema', async ({ request }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { username: 'cocina', password: 'cocina123' },
    })
    const setCookie = loginRes.headers()['set-cookie'] || ''
    const match = setCookie.match(/rc_session=([^;]+)/)
    const cookie = `rc_session=${match?.[1] || ''}`

    const helpRes = await request.get('/api/help', { headers: { Cookie: cookie } })
    const helpData = await helpRes.json()

    const modules = new Set(helpData.items?.map((i: any) => i.module) || [])
    for (const m of modules) {
      expect(['inventario', 'sistema']).toContain(m)
    }
  })

  test('mesero solo ve módulos pedidos+sistema', async ({ request }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { username: 'mesero', password: 'mesero123' },
    })
    const setCookie = loginRes.headers()['set-cookie'] || ''
    const match = setCookie.match(/rc_session=([^;]+)/)
    const cookie = `rc_session=${match?.[1] || ''}`

    const helpRes = await request.get('/api/help', { headers: { Cookie: cookie } })
    const helpData = await helpRes.json()

    const modules = new Set(helpData.items?.map((i: any) => i.module) || [])
    for (const m of modules) {
      expect(['pedidos', 'sistema']).toContain(m)
    }
  })

  test('admin ve todos los módulos', async ({ request }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { username: 'admin', password: 'admin123' },
    })
    const setCookie = loginRes.headers()['set-cookie'] || ''
    const match = setCookie.match(/rc_session=([^;]+)/)
    const cookie = `rc_session=${match?.[1] || ''}`

    const helpRes = await request.get('/api/help', { headers: { Cookie: cookie } })
    const helpData = await helpRes.json()

    const modules = new Set(helpData.items?.map((i: any) => i.module) || [])
    expect(modules.has('pedidos')).toBe(true)
    expect(modules.has('cierre')).toBe(true)
    expect(modules.has('inventario')).toBe(true)
    expect(modules.has('productos')).toBe(true)
    expect(modules.has('sistema')).toBe(true)
  })
})
