// ============================================================
// POST /api/internal/emit — puente servidor → socket.io (seguro)
// ============================================================
// v1.0-RC1-bloque4-5 (item 27):
//   Endpoint interno que recibe { room, event, data, clientOperationId }
//   y reenvía al servicio socket.io en el puerto 3003.
//
//   Accesible SOLO desde localhost. Cualquier petición externa recibe
//   403. Esto evita que un cliente malicioso emita eventos arbitrarios.
//
//   No requiere autenticación de usuario: la auth se hace por IP.
//   Los endpoints de API lo llaman desde dentro del propio proceso,
//   por lo que la petición siempre viene de localhost.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

const REALTIME_SERVICE_URL = 'http://localhost:3003/emit'
const PORT = process.env.PORT || '3000'

function isLocalRequest(req: NextRequest): boolean {
  // Aceptamos IPv4 y IPv6 loopback.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (ip && (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1')) {
    return true
  }
  // Si no hay x-forwarded-for, comprobamos el host del origin/referer
  const host = req.headers.get('host') || ''
  if (host.startsWith('localhost:') || host.startsWith('127.0.0.1:')) {
    return true
  }
  // Si la petición viene del propio servidor (fetch interno sin Host explícito),
  // Next.js añade `host: localhost:PORT`.
  if (host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}`) {
    return true
  }
  return false
}

export async function POST(req: NextRequest) {
  // Item 27: solo accesible desde localhost
  if (!isLocalRequest(req)) {
    return NextResponse.json(
      { ok: false, error: 'FORBIDDEN: solo accesible desde localhost' },
      { status: 403 },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }

  const { room, event, data, clientOperationId } = body || {}
  if (typeof room !== 'string' || typeof event !== 'string' || typeof data !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'Parámetros inválidos: se requiere { room, event, data }' },
      { status: 400 },
    )
  }

  try {
    const upstream = await fetch(REALTIME_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, event, data, clientOperationId }),
      cache: 'no-store',
    })
    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => '')
      return NextResponse.json(
        {
          ok: false,
          error: `realtime service respondió ${upstream.status}`,
          details: txt.slice(0, 200),
        },
        { status: 502 },
      )
    }
    const json = await upstream.json().catch(() => ({ ok: true }))
    return NextResponse.json({ ok: true, upstream: json })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'No se pudo contactar al servicio realtime', details: err?.message },
      { status: 502 },
    )
  }
}

// GET: útil para smoke tests internos
export async function GET(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }
  return NextResponse.json({ ok: true, service: 'internal-emit', port: PORT })
}
