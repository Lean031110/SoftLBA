// ============================================================
// Middleware - Protege rutas según autenticación y rol
// ============================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth/token'

const SESSION_COOKIE = 'rc_session'

// Rutas públicas (no requieren auth)
const PUBLIC_ROUTES = ['/', '/login', '/logout', '/api/auth', '/api/public', '/offline', '/manifest.json', '/sw.js', '/api/health']

// Rutas autenticadas pero accesibles por cualquier rol
const AUTH_COMMON_ROUTES = ['/primer-acceso', '/perfil', '/ayuda', '/api/notifications']

// Mapeo de prefijo de ruta -> roles permitidos
const ROUTE_ROLE_MAP: { prefix: string; roles: string[] }[] = [
  { prefix: '/admin', roles: ['ADMIN', 'CAJERO', 'MESERO_PRO'] },
  { prefix: '/mesero', roles: ['ADMIN', 'MESERO', 'MESERO_PRO'] },
  { prefix: '/cocina', roles: ['ADMIN', 'COCINA'] },
  { prefix: '/pizzeria', roles: ['ADMIN', 'PIZZERIA', 'COCINA'] },
  { prefix: '/api/admin/cierre-diario', roles: ['ADMIN', 'CAJERO', 'MESERO_PRO'] },
  { prefix: '/api/admin/finanzas', roles: ['ADMIN'] },
  { prefix: '/api/admin/respaldos', roles: ['ADMIN'] },
  { prefix: '/api/admin', roles: ['ADMIN'] },
  { prefix: '/api/mesero', roles: ['ADMIN', 'MESERO', 'MESERO_PRO'] },
  { prefix: '/api/cocina', roles: ['ADMIN', 'COCINA'] },
  { prefix: '/api/pizzeria', roles: ['ADMIN', 'PIZZERIA', 'COCINA'] },
  { prefix: '/api/cajero', roles: ['ADMIN', 'CAJERO'] },
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rutas públicas - permitir
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next()
  }

  // Archivos estáticos - permitir
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Verificar sesión
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  const session = await verifySessionToken(token)
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'SESION_EXPIRADA' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Verificar permiso por rol
  // Si es ruta común autenticada, permitir (cualquier rol autenticado)
  if (AUTH_COMMON_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next()
  }

  // Buscar el prefijo más específico que coincida (ordenado por longitud descendente)
  const matchingRoutes = ROUTE_ROLE_MAP
    .filter(({ prefix }) => pathname === prefix || pathname.startsWith(prefix + '/'))
    .sort((a, b) => b.prefix.length - a.prefix.length)

  if (matchingRoutes.length > 0) {
    const { roles } = matchingRoutes[0]
    if (!roles.includes(session.role)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
      }
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', '/')
      url.searchParams.set('error', 'sin_permiso')
      return NextResponse.redirect(url)
    }
  }

  // v1.0.20-rc-final: headers de seguridad obligatorios para POS.
  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    )
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
