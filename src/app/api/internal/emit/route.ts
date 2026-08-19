// ============================================================
// POST /api/internal/emit — puente servidor → socket.io (seguro)
// ============================================================
// v1.0.17 (CONSOLIDACIÓN): doble factor de autenticación:
//   1. La petición debe venir de localhost (127.0.0.1/::1).
//   2. La petición debe incluir header `X-Internal-Secret` con el valor
//      de REALTIME_SECRET (env var).
//
// Esto evita el bypass por header spoofing: aunque un atacante consiga
// hacer pasar su petición por "localhost", necesita conocer el secreto.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

const REALTIME_SERVICE_URL = process.env.REALTIME_SERVICE_URL || 'http://localhost:3003/emit'
const PORT = process.env.PORT || '3000'

function getInternalSecret(): string | null {
  const secret = process.env.REALTIME_SECRET
  if (secret && secret.length >= 16) return secret
  if (process.env.NODE_ENV === 'production') return null
  return 'dev-internal-secret-change-in-prod'
}

const INTERNAL_SECRET = getInternalSecret()

function isLocalRequest(req: NextRequest): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (ip && (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1')) return true
  const host = req.headers.get('host') || ''
  if (host.startsWith('localhost:') || host.startsWith('127.0.0.1:')) return true
  if (host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}`) return true
  return false
}

function hasValidSecret(req: NextRequest): boolean {
  if (!INTERNAL_SECRET) return false
  const fromHeader = req.headers.get('x-internal-secret')
  if (fromHeader && fromHeader === INTERNAL_SECRET) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN: solo accesible desde localhost' }, { status: 403 })
  }
  if (!hasValidSecret(req)) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN: secreto interno inválido o ausente' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }

  const { room, event, data, clientOperationId } = body || {}
  if (typeof room !== 'string' || typeof event !== 'string' || typeof data !== 'object') {
    return NextResponse.json({ ok: false, error: 'Parámetros inválidos: se requiere { room, event, data }' }, { status: 400 })
  }

  try {
    const secret = INTERNAL_SECRET || ''
    const upstream = await fetch(REALTIME_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
      body: JSON.stringify({ room, event, data, clientOperationId }),
      cache: 'no-store',
    })
    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => '')
      return NextResponse.json({ ok: false, error: `realtime service respondió ${upstream.status}`, details: txt.slice(0, 200) }, { status: 502 })
    }
    const json = await upstream.json().catch(() => ({ ok: true }))
    return NextResponse.json({ ok: true, upstream: json })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: 'No se pudo contactar al servicio realtime', details: err?.message }, { status: 502 })
  }
}

export async function GET(req: NextRequest) {
  if (!isLocalRequest(req) || !hasValidSecret(req)) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }
  return NextResponse.json({ ok: true, service: 'internal-emit', port: PORT })
}
