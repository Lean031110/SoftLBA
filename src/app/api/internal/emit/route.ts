// POST /api/internal/emit — bridge from the application server to Socket.IO.
// It is intentionally limited to a local caller plus REALTIME_SECRET.
import { NextRequest, NextResponse } from 'next/server'
import { getRuntimeEnvironment, requireRuntimeSecret, requireRuntimeUrl } from '@/lib/environment'

function isLocalRequest(req: NextRequest): boolean {
  const port = String(getRuntimeEnvironment().WEB_PORT || 3000)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true
  const host = req.headers.get('host') || ''
  return host === `localhost:${port}` || host === `127.0.0.1:${port}`
}

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-internal-secret')
  return Boolean(secret && secret === requireRuntimeSecret('REALTIME_SECRET'))
}

export async function POST(req: NextRequest) {
  try {
    if (!isLocalRequest(req) || !isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
    }
    const body = await req.json().catch(() => null)
    const { room, event, data, clientOperationId } = body || {}
    if (typeof room !== 'string' || typeof event !== 'string' || !data || typeof data !== 'object') {
      return NextResponse.json({ ok: false, error: 'Parámetros inválidos: se requiere { room, event, data }' }, { status: 400 })
    }
    const upstream = await fetch(requireRuntimeUrl('REALTIME_SERVICE_URL'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': requireRuntimeSecret('REALTIME_SECRET') },
      body: JSON.stringify({ room, event, data, clientOperationId }),
      cache: 'no-store',
    })
    if (!upstream.ok) {
      const details = await upstream.text().catch(() => '')
      return NextResponse.json({ ok: false, error: `realtime service respondió ${upstream.status}`, details: details.slice(0, 200) }, { status: 502 })
    }
    return NextResponse.json({ ok: true, upstream: await upstream.json().catch(() => ({ ok: true })) })
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'CONFIGURATION_OR_UPSTREAM_ERROR', details: (err as Error).message }, { status: 503 })
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!isLocalRequest(req) || !isAuthorized(req)) return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
    return NextResponse.json({ ok: true, service: 'internal-emit', port: getRuntimeEnvironment().WEB_PORT || 3000 })
  } catch {
    return NextResponse.json({ ok: false, error: 'CONFIGURATION_ERROR' }, { status: 503 })
  }
}
