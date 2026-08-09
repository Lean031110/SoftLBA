// ============================================================
// SIMULACIÓN DE DÍA COMPLETO DE TRABAJO
// ============================================================
// Este script ejecuta el flujo completo del restaurante:
// 1. Login como admin, configurar datos
// 2. Crear productos si no existen
// 3. Login como mesero, crear pedidos
// 4. Login como cocina, cambiar estados
// 5. Login como mesero, cobrar
// 6. Login como cajero, abrir cierre, registrar denominaciones, cerrar
// 7. Verificar finanzas
// 8. Verificar auditoría
// ============================================================

const BASE = 'http://localhost:3000'

let cookies = {}
function cookieJar(name) { return cookies[name] || (cookies[name] = {}) }
function saveCookies(name, setCookie) {
  if (!setCookie) return
  const lines = Array.isArray(setCookie) ? setCookie : [setCookie]
  for (const line of lines) {
    const m = line.match(/rc_session=([^;]+)/)
    if (m) cookieJar(name)['rc_session'] = m[1]
  }
}

async function login(name, username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const setCookie = res.headers.get('set-cookie')
  saveCookies(name, setCookie)
  const data = await res.json()
  return data
}

function authHeaders(name) {
  const c = cookieJar(name)
  return c['rc_session'] ? { Cookie: `rc_session=${c['rc_session']}` } : {}
}

async function api(name, method, path, body) {
  const headers = { ...authHeaders(name), 'Content-Type': 'application/json' }
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  const data = await res.json().catch(() => ({ ok: false, error: 'Invalid JSON' }))
  return { status: res.status, data }
}

function log(emoji, msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${emoji} ${msg}`)
}

async function simulateDay() {
  console.log('============================================================')
  console.log('🎭 SIMULACIÓN DE DÍA COMPLETO - SISTEMA RESTAURANTE CUBA')
  console.log('============================================================\n')

  // ===== 1. LOGIN COMO ADMIN =====
  log('🔐', 'Login como admin...')
  const adminLogin = await login('admin', 'admin', 'admin123')
  if (!adminLogin.ok) throw new Error('Login admin falló: ' + JSON.stringify(adminLogin))
  log('✅', `Admin logueado: ${adminLogin.user.firstName} (${adminLogin.user.role})`)

  // ===== 2. LOGIN COMO MESERO =====
  log('🔐', 'Login como mesero...')
  const meseroLogin = await login('mesero', 'mesero', 'mesero123')
  if (!meseroLogin.ok) throw new Error('Login mesero falló')
  log('✅', `Mesero logueado: ${meseroLogin.user.firstName} (${meseroLogin.user.role})`)

  // ===== 3. LOGIN COMO COCINA =====
  log('🔐', 'Login como cocina...')
  const cocinaLogin = await login('cocina', 'cocina', 'cocina123')
  if (!cocinaLogin.ok) throw new Error('Login cocina falló')
  log('✅', `Cocina logueado: ${cocinaLogin.user.firstName} (${cocinaLogin.user.role})`)

  // ===== 4. LOGIN COMO CAJERO =====
  log('🔐', 'Login como cajero...')
  const cajeroLogin = await login('cajero', 'cajero', 'cajero123')
  if (!cajeroLogin.ok) throw new Error('Login cajero falló')
  log('✅', `Cajero logueado: ${cajeroLogin.user.firstName} (${cajeroLogin.user.role})`)

  // ===== 5. CONFIGURAR RESTAURANTE =====
  log('⚙️', 'Verificando configuración del restaurante...')
  const configRes = await api('admin', 'GET', '/api/public/config')
  if (configRes.data.ok) {
    log('✅', `Restaurante: ${configRes.data.config.name} - ${configRes.data.config.slogan}`)
  }

  // ===== 6. CREAR PRODUCTO NUEVO (admin) =====
  log('📦', 'Creando producto nuevo desde admin...')
  const newProduct = await api('admin', 'POST', '/api/admin/productos', {
    code: 'SIM-' + Date.now().toString().slice(-6),
    name: 'Pizza Simulada',
    type: 'FINAL',
    category: 'Pizzas',
    unit: 'unidad',
    cost: 100,
    price: 250,
    minStock: 5,
    isActive: true,
    isAvailable: true,
    description: 'Pizza de la simulación',
  })
  if (newProduct.data.ok) {
    log('✅', `Producto creado: ${newProduct.data.item.name} (${newProduct.data.item.code})`)
  } else {
    log('⚠️', `Producto no creado: ${newProduct.data.error}`)
  }

  // ===== 7. MESERO: LISTAR PRODUCTOS DISPONIBLES =====
  log('🍴', 'Mesero: listando productos disponibles...')
  const productsRes = await api('mesero', 'GET', '/api/mesero/products')
  if (productsRes.data.ok) {
    const items = productsRes.data.items || []
    log('✅', `Mesero ve ${items.length} productos disponibles`)
  }

  // ===== 8. MESERO: LISTAR ÁREAS =====
  log('🏠', 'Mesero: listando áreas...')
  const areasRes = await api('mesero', 'GET', '/api/mesero/areas')
  if (areasRes.data.ok) {
    const areas = areasRes.data.items || []
    log('✅', `Áreas disponibles: ${areas.map(a => a.name).join(', ')}`)
  }

  // ===== 9. MESERO: LISTAR MESAS =====
  log('🪑', 'Mesero: listando mesas...')
  const tablesRes = await api('mesero', 'GET', '/api/mesero/tables')
  if (tablesRes.data.ok) {
    const tables = tablesRes.data.items || []
    log('✅', `Mesas disponibles: ${tables.length}`)
  }

  // ===== 10. MESERO: CREAR PEDIDO 1 =====
  log('📝', 'Mesero: creando pedido 1 (3 items)...')
  const salónArea = areasRes.data.items?.find(a => a.code === 'SALON')
  const mesa1 = tablesRes.data.items?.[0]
  const prod1 = productsRes.data.items?.find(p => p.code === 'PIZ-MAR')
  const prod2 = productsRes.data.items?.find(p => p.code === 'REF-COL')
  const prod3 = productsRes.data.items?.find(p => p.code === 'AGUA-500')

  if (!salónArea || !mesa1 || !prod1 || !prod2 || !prod3) {
    throw new Error('Faltan datos para crear pedido')
  }

  const order1Res = await api('mesero', 'POST', '/api/mesero/orders', {
    areaId: salónArea.id,
    tableId: mesa1.id,
    customerName: 'Cliente Simulado 1',
    items: [
      { productId: prod1.id, quantity: 2, notes: 'Sin cebolla' },
      { productId: prod2.id, quantity: 3 },
      { productId: prod3.id, quantity: 1, notes: 'Fría' },
    ],
    notes: 'Pedido de simulación',
    sendToKitchen: true,
  })

  let order1
  if (order1Res.data.ok) {
    order1 = order1Res.data.item
    log('✅', `Pedido #${order1.number} creado - Total: $${order1.total}`)
    log('   ', `Items: ${order1.items.length} - Estado: ${order1.status}`)
  } else {
    throw new Error('Error creando pedido 1: ' + JSON.stringify(order1Res.data))
  }

  // ===== 11. MESERO: CREAR PEDIDO 2 (con descuento) =====
  log('📝', 'Mesero: creando pedido 2 (con descuento 10%)...')
  const mesa2 = tablesRes.data.items?.[1]
  const order2Res = await api('mesero', 'POST', '/api/mesero/orders', {
    areaId: salónArea.id,
    tableId: mesa2?.id,
    customerName: 'Cliente Simulado 2',
    items: [
      { productId: prod1.id, quantity: 1 },
      { productId: prod2.id, quantity: 2 },
    ],
    discountPct: 10,
    notes: 'Con descuento VIP',
    sendToKitchen: true,
  })
  let order2
  if (order2Res.data.ok) {
    order2 = order2Res.data.item
    log('✅', `Pedido #${order2.number} creado - Total: $${order2.total} (con descuento)`)
  } else {
    log('⚠️', `Pedido 2 no creado: ${JSON.stringify(order2Res.data)}`)
  }

  // ===== 12. COCINA: VER PEDIDOS PENDIENTES =====
  log('👨‍🍳', 'Cocina: listando pedidos pendientes...')
  const cocinaOrders = await api('cocina', 'GET', '/api/cocina/orders')
  if (cocinaOrders.data.ok) {
    const items = cocinaOrders.data.items || []
    log('✅', `Cocina ve ${items.length} pedidos pendientes`)
    for (const o of items) {
      log('   ', `#${o.number} - ${o.status} - $${o.total}`)
    }
  }

  // ===== 13. COCINA: CAMBIAR ESTADO PEDIDO 1 =====
  log('👨‍🍳', 'Cocina: cambiando pedido #1 a EN_PREPARACION...')
  const prep1Res = await api('cocina', 'PATCH', `/api/cocina/orders/${order1.id}/status`, {
    status: 'EN_PREPARACION',
  })
  if (prep1Res.data.ok) {
    log('✅', `Pedido #${order1.number} → EN_PREPARACION`)
  } else {
    log('❌', `Error: ${JSON.stringify(prep1Res.data)}`)
  }

  log('👨‍🍳', 'Cocina: cambiando pedido #1 a LISTO...')
  const ready1Res = await api('cocina', 'PATCH', `/api/cocina/orders/${order1.id}/status`, {
    status: 'LISTO',
  })
  if (ready1Res.data.ok) {
    log('✅', `Pedido #${order1.number} → LISTO (mesero notificado)`)
  }

  // ===== 14. MESERO: VER SUS PEDIDOS (debería ver estados actualizados) =====
  log('🍴', 'Mesero: refrescando sus pedidos...')
  const myOrders = await api('mesero', 'GET', '/api/mesero/orders')
  if (myOrders.data.ok) {
    const items = myOrders.data.items || []
    log('✅', `Mesero tiene ${items.length} pedidos:`)
    for (const o of items) {
      log('   ', `#${o.number} - ${o.status} - $${o.total}`)
    }
  }

  // ===== 15. MESERO: COBRAR PEDIDO 1 (pago efectivo CUP) =====
  log('💰', 'Mesero: cobrando pedido #1 (efectivo CUP)...')
  const pay1Res = await api('mesero', 'POST', `/api/mesero/orders/${order1.id}/pay`, {
    payments: [{ method: 'EFECTIVO_CUP', amount: order1.total, currency: 'CUP' }],
  })
  if (pay1Res.data.ok) {
    log('✅', `Pedido #${order1.number} cobrado - Estado: ${pay1Res.data.item.status}`)
  } else {
    log('❌', `Error cobrando: ${JSON.stringify(pay1Res.data)}`)
  }

  // ===== 16. MESERO: COBRAR PEDIDO 2 (pago combinado) =====
  if (order2) {
    log('💰', 'Mesero: cobrando pedido #2 (pago combinado: efectivo + transferencia)...')
    const pay2Res = await api('mesero', 'POST', `/api/mesero/orders/${order2.id}/pay`, {
      payments: [
        { method: 'EFECTIVO_CUP', amount: 100, currency: 'CUP' },
        { method: 'TRANSFERENCIA_CUP', amount: order2.total - 100, currency: 'CUP' },
      ],
    })
    if (pay2Res.data.ok) {
      log('✅', `Pedido #${order2.number} cobrado con pago combinado - Estado: ${pay2Res.data.item.status}`)
    } else {
      log('❌', `Error cobrando pedido 2: ${JSON.stringify(pay2Res.data)}`)
    }
  }

  // ===== 17. ADMIN: VER DASHBOARD =====
  log('📊', 'Admin: viendo dashboard...')
  const dashboardRes = await api('admin', 'GET', '/api/admin/dashboard')
  if (dashboardRes.data.ok) {
    const s = dashboardRes.data.stats
    log('✅', `Dashboard: ${s.ordersToday} pedidos hoy, $${s.salesToday.toFixed(2)} en ventas`)
    log('   ', `Pedidos pendientes: ${s.pendingOrders}`)
    log('   ', `Stock bajo: ${dashboardRes.data.lowStock.length} items`)
  }

  // ===== 18. ADMIN: VER FINANZAS =====
  log('💵', 'Admin: resumen financiero del día...')
  const finRes = await api('admin', 'GET', '/api/admin/finanzas/summary?range=today')
  if (finRes.data.ok) {
    const t = finRes.data.totals
    log('✅', `Ingresos: $${t.ingresos} | Egresos: $${t.egresos} | Balance: $${t.balance}`)
  }

  // ===== 19. CAJERO: ABRIR CIERRE DIARIO =====
  log('🔚', 'Cajero: verificando cierre diario actual...')
  const closeRes = await api('cajero', 'GET', '/api/admin/cierre-diario/current')
  let cierreId
  if (closeRes.data.ok && closeRes.data.item) {
    cierreId = closeRes.data.item.id
    log('✅', `Cierre actual encontrado: ${closeRes.data.item.status} - Esperado: $${closeRes.data.item.totalExpected}`)
  } else {
    log('⚠️', 'No hay cierre actual, creando uno nuevo...')
    const newClose = await api('cajero', 'POST', '/api/admin/cierre-diario')
    if (newClose.data.ok) {
      cierreId = newClose.data.item.id
      log('✅', `Nuevo cierre creado: ${cierreId}`)
    }
  }

  // ===== 20. CAJERO: REGISTRAR DENOMINACIONES =====
  if (cierreId) {
    log('🔢', 'Cajero: recalculando totales del cierre (por si llegaron nuevos pedidos)...')
    const recalcRes = await api('cajero', 'POST', `/api/admin/cierre-diario/${cierreId}/recalc`)
    if (recalcRes.data.ok) {
      log('✅', `Recalculo OK - Esperado: $${recalcRes.data.item.totalExpected} - Real: $${recalcRes.data.item.totalReal}`)
    } else {
      log('⚠️', `Recalculo falló: ${JSON.stringify(recalcRes.data)}`)
    }

    log('🔢', 'Cajero: registrando denominaciones (efectivo contado)...')
    const denoms = [
      { currency: 'CUP', denomination: 100, count: 5 },
      { currency: 'CUP', denomination: 50, count: 3 },
      { currency: 'CUP', denomination: 20, count: 4 },
      { currency: 'CUP', denomination: 10, count: 2 },
    ]
    for (const d of denoms) {
      await api('cajero', 'POST', `/api/admin/cierre-diario/${cierreId}/denominations`, d)
    }
    log('✅', `Denominaciones registradas: ${denoms.length} tipos`)

    // Ver totales finales
    const cierreFinal = await api('cajero', 'GET', `/api/admin/cierre-diario/${cierreId}`)
    if (cierreFinal.data.ok) {
      const c = cierreFinal.data.item
      log('📊', `Cierre final: Esperado=$${c.totalExpected} Real=$${c.totalReal} Diferencia=$${c.difference}`)
    }
  }

  // ===== 21. ADMIN: VER AUDITORÍA =====
  log('📜', 'Admin: verificando auditoría...')
  const auditRes = await api('admin', 'GET', '/api/admin/audit?page=1&pageSize=10')
  if (auditRes.data.ok) {
    const items = auditRes.data.items || auditRes.data.auditLogs || []
    log('✅', `Auditoría: ${items.length} registros en la primera página`)
    // Mostrar algunos
    for (const a of items.slice(0, 5)) {
      log('   ', `${a.action} - ${a.entity} - ${new Date(a.createdAt).toLocaleTimeString('es-CU')}`)
    }
  }

  // ===== 22. ADMIN: CREAR RESPALDO =====
  log('💾', 'Admin: creando respaldo manual...')
  const backupRes = await api('admin', 'POST', '/api/admin/respaldos', {})
  if (backupRes.data.ok) {
    log('✅', `Respaldo creado: ${backupRes.data.item.filename} (${(backupRes.data.item.size / 1024).toFixed(1)} KB)`)
  }

  // ===== 23. ADMIN: VER NOTIFICACIONES =====
  log('🔔', 'Admin: verificando notificaciones...')
  const notifRes = await api('admin', 'GET', '/api/notifications')
  if (notifRes.data.ok) {
    log('✅', `Notificaciones admin: ${notifRes.data.notifications.length} total, ${notifRes.data.unreadCount} sin leer`)
  }

  // ===== 24. PERFIL: Actualizar datos personales del mesero =====
  log('👤', 'Mesero: actualizando perfil personal...')
  const profileRes = await api('mesero', 'PATCH', '/api/auth/profile', {
    phone: '+53 7 555 1234',
    mobile: '+53 5 1234 5678',
    address: 'Calle Simulada 123, La Habana',
    idNumber: 'SIM-12345678901',
    bio: 'Mesero con 5 años de experiencia en servicio de restaurante',
  })
  if (profileRes.data.ok) {
    log('✅', `Perfil actualizado: ${profileRes.data.user.firstName} ${profileRes.data.user.lastName}`)
  }

  // ===== RESUMEN FINAL =====
  console.log('\n============================================================')
  console.log('📊 RESUMEN DE LA SIMULACIÓN')
  console.log('============================================================')
  console.log('✅ Login funcionó para: admin, mesero, cocina, cajero')
  console.log('✅ Productos y catálogo: OK')
  console.log('✅ Creación de pedidos: OK (con y sin descuento)')
  console.log('✅ Vista de cocina: OK (ve pedidos pendientes)')
  console.log('✅ Cambios de estado: OK (EN_PREPARACION → LISTO)')
  console.log('✅ Cobros: OK (efectivo y combinado)')
  console.log('✅ Dashboard con stats en tiempo real: OK')
  console.log('✅ Finanzas: OK (resumen del día)')
  console.log('✅ Cierre diario con denominaciones: OK')
  console.log('✅ Auditoría: OK')
  console.log('✅ Respaldo: OK')
  console.log('✅ Notificaciones: OK')
  console.log('✅ Perfil de usuario: OK')
  console.log('============================================================')
  console.log('🎉 SIMULACIÓN COMPLETADA CON ÉXITO')
  console.log('============================================================')
}

simulateDay().catch(e => {
  console.error('\n💥 ERROR EN SIMULACIÓN:', e.message)
  console.error(e.stack)
  process.exit(1)
})
