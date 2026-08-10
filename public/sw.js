// ============================================================
// Service Worker - SoftLBA PWA
// ============================================================
// Maneja:
// - Cache de archivos estáticos
// - Página offline cuando no hay conexión al servidor
// - Detección de red (WiFi del servidor)
// ============================================================

const CACHE_NAME = 'softlba-v0.8.0'
const OFFLINE_URL = '/offline'
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/softlba-logo.svg',
  '/softlba-logo.png',
  '/softlba-favicon.png',
  '/manifest.json',
]

// Instalar service worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando service worker...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando archivos estáticos')
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Error cacheando algunos archivos:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activar service worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando service worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Eliminando cache viejo:', name)
            return caches.delete(name)
          })
      )
    })
  )
  self.clients.claim()
})

// Interceptar fetch
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // No interceptar API requests (siempre van al servidor)
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // No interceptar WebSocket
  if (request.url.includes('XTransformPort') || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return
  }

  // Para navegación (páginas), intentar red primero, luego cache, luego offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Si la red funciona, cachear la respuesta
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
          return response
        })
        .catch(() => {
          // Si no hay red, intentar cache
          return caches.match(request).then((cached) => {
            if (cached) return cached
            // Si no está en cache, mostrar página offline
            return caches.match(OFFLINE_URL)
          })
        })
    )
    return
  }

  // Para otros recursos (CSS, JS, imágenes), estrategia cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          // Solo cachear respuestas OK
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
          return response
        })
        .catch(() => {
          // Si no hay red y no está en cache, devolver vacío
          return new Response('', { status: 503, statusText: 'Offline' })
        })
    })
  )
})

// Escuchar mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Notificaciones push
self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido:', event)
  let data = { title: 'SoftLBA', body: 'Nueva notificación' }
  try {
    data = event.data.json()
  } catch (e) {
    data.body = event.data ? event.data.text() : data.body
  }

  const options = {
    body: data.body || data.message,
    icon: '/softlba-logo.png',
    badge: '/softlba-favicon.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'softlba-notification',
    data: data.data || {},
    actions: data.actions || [
      { action: 'ok', title: 'OK' },
      { action: 'dismiss', title: 'Descartar' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'SoftLBA', options)
  )
})

// Click en notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Click en notificación:', event)
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Si ya hay una ventana abierta, enfocarla
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      // Si no, abrir nueva ventana
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
