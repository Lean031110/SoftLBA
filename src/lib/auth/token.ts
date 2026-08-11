// ============================================================
// Verificación de token (compatible con Edge runtime)
// ============================================================
// No usa `cookies()` ni `db` para poder ejecutarse en middleware.
// Usa Web Crypto API (compatible con Edge y Node runtimes).
//
// Seguridad (FIX 9):
//   - En production: NEXTAUTH_SECRET debe estar definido (>= 16 chars).
//     Si falta, se lanza un error al importar este módulo.
//   - En development: fallback a un valor por defecto para tests locales.
// ============================================================

function getSecret(): string {
  const envSecret = process.env.NEXTAUTH_SECRET
  if (envSecret && envSecret.length >= 16) return envSecret
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXTAUTH_SECRET no configurado. En producción es obligatorio definir NEXTAUTH_SECRET (>= 16 chars).',
    )
  }
  // Solo en development: fallback para tests locales.
  return 'cuba-restaurante-secret-key-change-in-prod'
}

const SECRET = getSecret()

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function computeHmac(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const keyData = enc.encode(SECRET)
  // crypto.subtle está disponible tanto en Edge como en Node 16+ runtime.
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return bytesToHex(sig)
}

export async function verifySessionToken(token: string): Promise<{ userId: string; role: string; expiresAt: number } | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 4) return null
    const [userId, role, expiresAtStr, signature] = parts
    const payload = `${userId}.${role}.${expiresAtStr}`
    const expectedSig = await computeHmac(payload)
    if (signature !== expectedSig) return null

    const expiresAt = parseInt(expiresAtStr, 10)
    if (Date.now() > expiresAt) return null

    return { userId, role, expiresAt }
  } catch {
    return null
  }
}
