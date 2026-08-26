// ============================================================
// Service Worker - SoftLBA PWA
// ============================================================
// v1.0.20-rc-final: versión sincronizada con package.json vía el script
// de build que inyecta NEXT_PUBLIC_APP_VERSION. Para simplicidad, el SW
// usa una constante que debe bump-earse con cada release.
// Estrategias:
//  - Network-first  → páginas de navegación (HTML)
//  - Cache-first   → assets estáticos (CSS, JS, fonts, imágenes)
//  - Stale-while-revalidate → fuentes e imágenes críticas
//  - Background Sync → recupera operaciones POST/PUT al volver la red
//  - Push notifications → avisa de pedidos nuevos aunque la app esté cerrada
// ============================================================

// FE-001 (FRONTEND-01): Versión sincronizada con package.json.
// El SW no puede importar módulos TS, así que esta constante debe bump-earse
// manualmente con cada release. Compara con `src/lib/app-version.ts`.
// FASE 1: validada por `tests/unit/version-consistency.test.ts` para que
// nunca se desincronice de `package.json` nuevamente.
const SW_VERSION = "softlba-v1.1.0-rc7"
const OFFLINE_URL = '/offline'

// FE-001 (FRONTEND-01): Operaciones permitidas para Background Sync.
// Lista EXHAUSTIVA de {method, path} que pueden encolarse cuando el servidor
// local no responde. Cada entrada debe estar diseñada con idempotencia
// explícita + reconciliación en el backend.
//
// LISTA VACÍA por defecto porque el plan prohíbe "cola offline universal":
//   "No todas las mutaciones deben entrar en Background Sync."
//   "Pago: NO, salvo diseño explícto con idempotencia/reconciliación"
//   "Crear pedido: Solo si existe estrategia idempotente y reconciliación"
//
// Para agregar una operación:
//   1. Verificar que el backend tiene idempotencyKey o similar.
//   2. Documentar la operación en docs/FRONTEND_API_CONTRACT.md.
//   3. Agregar prueba E2E que simule offline + retry + reconciliación.
//   4. Solo entonces agregarla aquí.
const OFFLINE_ALLOWED_OPERATIONS = [
  // Ejemplo (NO activo hasta que se cumplan los pasos anteriores):
  // { method: 'POST', path: '/api/mesero/orders' },
]

// Caches separados para invalidación granular
const CACHE_PAGES = `${SW_VERSION}-pages`
const CACHE_ASSETS = `${SW_VERSION}-assets`
const CACHE_IMAGES = `${SW_VERSION}-images`
const CACHE_FONTS = `${SW_VERSION}-fonts`

// Assets críticos que se cachean en install (app shell)
const CRITICAL_ASSETS = [
  '/',
  '/offline',
  '/softlba-logo.svg',
  '/softlba-logo.png',
  '/softlba-favicon.png',
  '/manifest.json',
  '/globals.css',
]

// Patrones para enrutar las estrategias
const STATIC_ASSET_RE = /\.(?:css|js|woff2?|ttf|eot|otf|wasm|map)$/
const IMAGE_RE = /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/
const FONT_RE = /\.(?:woff2?|ttf|eot|otf)$/

// ------------------------------------------------------------
// Instalación: pre-cache del app shell
// ------------------------------------------------------------
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando service worker v1.0.20-rc-final...')
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_ASSETS)
      // addAll falla si uno solo falla; hacemos best-effort
      await Promise.allSettled(
        CRITICAL_ASSETS.map((url) =>
          fetch(url)
            .then((res) => {
              if (res.ok) return cache.put(url, res.clone())
            })
            .catch((err) => console.warn('[SW] No se pudo cachear', url, err))
        )
      )
      console.log('[SW] App shell cacheado')
    })()
  )
  self.skipWaiting()
})

// ------------------------------------------------------------
// Activación: limpia caches viejos y toma control
// ------------------------------------------------------------
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando service worker v1.0.20-rc-final...')
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(SW_VERSION))
          .map((key) => {
            console.log('[SW] Eliminando cache viejo:', key)
            return caches.delete(key)
          })
      )
      await self.clients.claim()
      // Avisar a los clientes que hay una nueva versión disponible
      const clientsList = await self.clients.matchAll({ type: 'window' })
      clientsList.forEach((client) => {
        client.postMessage({ type: 'SW_UPDATED', version: SW_VERSION })
      })
    })()
  )
})

// ------------------------------------------------------------
// Helper: network-first para navegación
// ------------------------------------------------------------
async function networkFirstNavigation(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_PAGES)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (err) {
    const cached = await caches.match(request)
    if (cached) return cached
    const offline = await caches.match(OFFLINE_URL)
    return (
      offline ||
      new Response(
        '<h1>Sin conexión</h1><p>SoftLBA no está disponible sin red.</p>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    )
  }
}

// ------------------------------------------------------------
// Helper: cache-first para assets estáticos (CSS, JS, fuentes)
// ------------------------------------------------------------
async function cacheFirstStatic(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const networkResponse = await fetch(request)
    if (
      networkResponse &&
      (networkResponse.ok || networkResponse.type === 'opaque') &&
      networkResponse.status !== 206
    ) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (err) {
    // Fallback para SVG (usado como logo)
    if (request.url.endsWith('.svg')) {
      const logoFallback = await caches.match('/softlba-logo.svg')
      if (logoFallback) return logoFallback
    }
    return new Response('', { status: 503, statusText: 'Offline' })
  }
}

// ------------------------------------------------------------
// Helper: stale-while-revalidate para imágenes
// ------------------------------------------------------------
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (
        networkResponse &&
        (networkResponse.ok || networkResponse.type === 'opaque')
      ) {
        cache.put(request, networkResponse.clone())
      }
      return networkResponse
    })
    .catch(() => cached)
  return cached || fetchPromise
}

// ------------------------------------------------------------
// Interceptar fetch y enrutar a estrategia
// ------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Solo GET
  if (request.method !== 'GET') {
    // FE-001 (FRONTEND-01): La política ANTERIOR interceptaba TODOS los
    // POST/PUT/DELETE de /api/* y devolvía `202 offline-queued` SIN intentar
    // el fetch real. Eso rompía el POS aunque el servidor estuviera disponible.
    //
    // Política nueva (alineada con docs/FRONTEND_MASTER_PLAN.md sección 4):
    // 1. Intentar el fetch al servidor LOCAL PRIMERO (no encolar ciegamente).
    // 2. Si responde 2xx → devolver la respuesta real.
    // 3. Si la red falla O responde no-2xx → NO encolar automáticamente;
    //    solo las operaciones en `OFFLINE_ALLOWED_OPERATIONS` se encolan.
    //    Las demás devuelven 503 "Servidor local no disponible".
    // 4. Rutas de auth SIEMPRE pasan directo (no se interceptan).
    //
    // Actualmente `OFFLINE_ALLOWED_OPERATIONS` está VACÍO porque el plan prohíbe
    // "cola offline universal" — cada operación offline debe diseñarse con
    // idempotencia + reconciliación explícitas. Ver docs/FRONTEND_MASTER_PLAN.md
    // sección 4 tabla "Política recomendada".
    const SKIP_BG_SYNC_PATHS = [
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/socket-token',
      '/api/auth/me',
      '/api/auth/change-password',
      '/api/internal/',
    ]
    const shouldSkipBgSync = SKIP_BG_SYNC_PATHS.some(p => url.pathname.startsWith(p))

    if (!shouldSkipBgSync &&
      (request.method === 'POST' ||
        request.method === 'PUT' ||
        request.method === 'DELETE')
    ) {
      event.respondWith(handleMutationRequest(event))
    }
    return
  }

  // No interceptar API requests (siempre al servidor)
  if (url.pathname.startsWith('/api/')) return

  // No interceptar WebSocket requests.
  if (
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return
  }

  // Navegación (HTML) → network-first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  // Fuentes → cache-first con prioridad alta
  if (FONT_RE.test(url.pathname)) {
    event.respondWith(cacheFirstStatic(request, CACHE_FONTS))
    return
  }

  // CSS/JS/WASM → cache-first
  if (STATIC_ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirstStatic(request, CACHE_ASSETS))
    return
  }

  // Imágenes → stale-while-revalidate
  if (IMAGE_RE.test(url.pathname) || request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, CACHE_IMAGES))
    return
  }

  // Default: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, CACHE_ASSETS))
})

// ------------------------------------------------------------
// Background Sync: encola operaciones fallidas y las reenvía
// ------------------------------------------------------------
const SYNC_QUEUE_DB = 'softlba-sync-queue'
const SYNC_QUEUE_STORE = 'pending-requests'
const SYNC_TAG = 'softlba-sync'

function openSyncDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) {
      reject(new Error('IndexedDB no disponible'))
      return
    }
    const req = indexedDB.open(SYNC_QUEUE_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function enqueueRequest(request) {
  try {
    const body = request.method === 'GET' ? null : await request.clone().text()
    const entry = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    }
    const db = await openSyncDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite')
      tx.objectStore(SYNC_QUEUE_STORE).add(entry)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
    console.log('[SW] Request encolado para background sync:', request.url)
  } catch (err) {
    console.warn('[SW] No se pudo encolar request:', err)
  }
}

async function flushQueue() {
  let db
  try {
    db = await openSyncDB()
  } catch (err) {
    console.warn('[SW] IndexedDB no disponible para flush:', err)
    return
  }
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite')
  const store = tx.objectStore(SYNC_QUEUE_STORE)
  const allReq = store.getAll()
  await new Promise((resolve) => {
    allReq.onsuccess = resolve
  })
  const entries = allReq.result || []
  for (const entry of entries) {
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      })
      if (res.ok) {
        await new Promise((resolve) => {
          const delTx = db.transaction(SYNC_QUEUE_STORE, 'readwrite')
          delTx.objectStore(SYNC_QUEUE_STORE).delete(entry.id)
          delTx.oncomplete = resolve
        })
        console.log('[SW] Request reenviado con éxito:', entry.url)
      }
    } catch (err) {
      console.warn('[SW] Reintento falló, se mantendrá en cola:', entry.url)
      break // si falla la red otra vez, dejamos el resto para el próximo sync
    }
  }
}

// FE-001 (FRONTEND-01): Handler nuevo para mutaciones (POST/PUT/DELETE).
// Estrategia: try network first; solo encolar si la operación está en
// `OFFLINE_ALLOWED_OPERATIONS` y la red falló.
//
// Respuestas posibles:
//  - 2xx real del servidor → forward al cliente.
//  - 4xx/5xx real del servidor → forward al cliente (no encolamos errores).
//  - Red caída + operación permitida → 202 offline-queued + encolar para retry.
//  - Red caída + operación NO permitida → 503 "Servidor local no disponible".
async function handleMutationRequest(event) {
  const { request } = event
  const url = new URL(request.url)

  // 1. Intentar el fetch al servidor LOCAL primero.
  try {
    const networkResponse = await fetch(event.request.clone())
    // Si el servidor respondió (cualquier código), devolver la respuesta real.
    // No encolamos ni siquiera si fue 4xx/5xx — el cliente decide qué hacer.
    return networkResponse
  } catch (networkErr) {
    // Red caída o servidor inalcanzable.
    console.warn('[SW] Mutation fetch failed:', url.pathname, networkErr?.message || networkErr)

    // 2. Verificar si la operación está permitida para offline.
    const isAllowed = OFFLINE_ALLOWED_OPERATIONS.some(
      (op) => url.pathname === op.path && request.method === op.method,
    )

    if (isAllowed && 'sync' in self.registration) {
      // Operación diseñada para offline: encolar para retry con BG Sync.
      await enqueueRequest(event.request)
      try {
        await self.registration.sync.register(SYNC_TAG)
        console.log('[SW] Background sync registrado para operación permitida:', url.pathname)
      } catch (err) {
        console.warn('[SW] Background sync no soportado:', err)
      }
      return new Response(
        JSON.stringify({ ok: false, error: 'offline-queued' }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // 3. Operación NO permitida para offline: devolver 503 claro.
    // El cliente debe mostrar "Servidor local no disponible", NO "offline-queued".
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'SERVIDOR_NO_DISPONIBLE',
        message: 'No se puede alcanzar el servidor local. Verifica que SoftLBA esté corriendo.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// Mantener handleBackgroundSyncRequest por compatibilidad con cualquier
// referencia pendiente (puede eliminarse cuando se confirme que no se usa).
async function handleBackgroundSyncRequest(event) {
  // v1.0.20-FRONTEND-01: depreciado — usar handleMutationRequest.
  // Redirige al nuevo handler para mantener compatibilidad.
  return handleMutationRequest(event)
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    console.log('[SW] Ejecutando background sync:', event.tag)
    event.waitUntil(flushQueue())
  }
})

// ------------------------------------------------------------
// Periodic Sync (cuando esté disponible) para refrescar datos
// ------------------------------------------------------------
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'softlba-refresh') {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_ASSETS)
        await cache.addAll(CRITICAL_ASSETS).catch(() => {})
      })()
    )
  }
})

// ------------------------------------------------------------
// Push notifications: avisa de nuevos pedidos aunque la app esté cerrada
// ------------------------------------------------------------
self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido:', event)
  let data = { type: 'generic', title: 'SoftLBA', body: 'Nueva notificación' }
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data = { ...data, body: event.data.text() }
    }
  }

  const eventType = (data.type || '').toLowerCase()
  const orderId = data.orderId || data.data?.orderId
  const orderNumber = data.orderNumber || data.data?.orderNumber

  // Plantillas por tipo de evento
  let title = data.title || 'SoftLBA'
  let body = data.body || data.message || ''
  let tag = `softlba-${eventType || 'notification'}`
  let url = data.data?.url || '/'
  const actions = []

  if (eventType === 'order:new' || eventType === 'order_new') {
    title = '📦 Nuevo pedido'
    body = orderNumber
      ? `Pedido #${orderNumber} recibido, pendiente de preparación`
      : body || 'Ha llegado un nuevo pedido'
    tag = `softlba-order-new-${orderId || Date.now()}`
    url = data.data?.url || '/cocina'
    actions.push({ action: 'view-order', title: 'Ver pedido' })
    actions.push({ action: 'dismiss', title: 'Descartar' })
  } else if (eventType === 'order:ready' || eventType === 'order_ready') {
    title = '✅ Pedido listo'
    body = orderNumber
      ? `El pedido #${orderNumber} está listo para servir`
      : body || 'Un pedido está listo'
    tag = `softlba-order-ready-${orderId || Date.now()}`
    url = data.data?.url || '/mesero'
    actions.push({ action: 'view-order', title: 'Ver pedido' })
    actions.push({ action: 'dismiss', title: 'Descartar' })
  } else if (eventType === 'order:status' || eventType === 'order_status') {
    title = '🔄 Estado de pedido actualizado'
    body = body || `Pedido #${orderNumber || ''} cambió de estado`
    tag = `softlba-order-status-${orderId || Date.now()}`
    url = data.data?.url || '/admin'
    actions.push({ action: 'view-order', title: 'Ver' })
  } else if (eventType === 'payment:done' || eventType === 'payment_done') {
    title = '💰 Cobro registrado'
    body = body || `Pago confirmado para el pedido #${orderNumber || ''}`
    tag = `softlba-payment-${orderId || Date.now()}`
    url = data.data?.url || '/admin'
    actions.push({ action: 'view-order', title: 'Ver' })
  } else if (eventType === 'stock:low' || eventType === 'stock_low') {
    title = '⚠️ Stock bajo'
    body = body || 'Un producto ha alcanzado su stock mínimo'
    tag = 'softlba-stock-low'
    url = data.data?.url || '/admin/inventario-general'
  } else if (eventType === 'daily-close' || eventType === 'daily_close') {
    title = '🔚 Cierre diario'
    body = body || 'Se ha realizado el cierre diario'
    tag = 'softlba-daily-close'
    url = data.data?.url || '/admin/cierre-diario'
  }

  const options = {
    body,
    icon: '/softlba-logo.png',
    badge: '/softlba-favicon.png',
    vibrate: [200, 100, 200, 100, 200],
    tag,
    data: { url, orderId, eventType, ...(data.data || {}) },
    actions: actions.length ? actions : undefined,
    requireInteraction: eventType.startsWith('order'),
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ------------------------------------------------------------
// Click en notificación
// ------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Click en notificación:', event)
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      // Si ya hay una ventana abierta en la app, enfocarla y navegar
      for (const client of clientList) {
        if ('focus' in client) {
          if (targetUrl && 'navigate' in client) {
            try {
              await client.focus()
              await client.navigate(targetUrl)
              return
            } catch {
              return client.focus()
            }
          }
          return client.focus()
        }
      }
      // Si no, abrir nueva ventana
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })()
  )
})

// ------------------------------------------------------------
// Mensajes desde el cliente
// ------------------------------------------------------------
self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  } else if (data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: SW_VERSION })
  } else if (data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.map((k) => caches.delete(k)))
      )
    )
  }
})
