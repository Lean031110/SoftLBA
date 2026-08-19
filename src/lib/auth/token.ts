// ============================================================
// Verificación de token (compatible con Edge runtime)
// ============================================================
// No usa `cookies()` ni `db` para poder ejecutarse en middleware.
// Usa Web Crypto API (compatible con Edge y Node runtimes).
//
// FASE 1 (CONSOLIDACIÓN v1.0.16) — FORMATO UNIFICADO:
//   El token tiene 5 partes: userId.role.expiresAt.authVersion.signature
//
//   authVersion permite invalidar sesiones existentes cuando:
//   - se cambia el rol del usuario;
//   - se cambia la contraseña;
//   - se desactiva el usuario;
//   - se hace logout global.
//
//   El middleware compara authVersion del token con el de la DB.
//   Si no coinciden, la sesión se rechaza.
//
// COMPATIBILIDAD:
//   Tokens legacy de 4 partes (sin authVersion) se aceptan temporalmente
//   con authVersion=0. Esto permite sesiones existentes tras un deploy.
//   Al expirar (12h máximo), el usuario debe re-loguearse y obtendrá
//   un token de 5 partes.
//
// Seguridad (FIX 9):
//   - En production: NEXTAUTH_SECRET debe estar definido (>= 16 chars).
//     Si falta, se lanza un error al importar este módulo.
//   - En development: fallback a un valor por defecto para tests locales.
// ============================================================

function getSecret(): string {
  // FASE 3 (config centralizada): los secretos viven en env vars (NO en config.json).
  // Aquí leemos NEXTAUTH_SECRET directamente porque este módulo debe ser
  // compatible con Edge runtime y con vitest (que no resuelve alias en runtime).
  // La validación de "obligatorio en prod" la hace getSecrets() en src/lib/config.
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

export interface VerifiedSession {
  userId: string
  role: string
  expiresAt: number
  authVersion: number
}

export async function verifySessionToken(token: string): Promise<VerifiedSession | null> {
  try {
    const parts = token.split('.')
    // Aceptar tanto 4 partes (legacy) como 5 partes (con authVersion).
    if (parts.length !== 4 && parts.length !== 5) return null

    const [userId, role, expiresAtStr, signatureOrAuthVer, maybeSignature] = parts

    let authVersion: number
    let signature: string
    let payload: string

    if (parts.length === 5) {
      // Formato unificado: userId.role.expiresAt.authVersion.signature
      authVersion = parseInt(signatureOrAuthVer, 10)
      signature = maybeSignature
      payload = `${userId}.${role}.${expiresAtStr}.${signatureOrAuthVer}`
    } else {
      // Formato legacy: userId.role.expiresAt.signature (4 partes)
      // authVersion=0 significa "no verificado"; el caller debe aceptar
      // esto solo para tokens viejos que expirarán pronto.
      authVersion = 0
      signature = signatureOrAuthVer
      payload = `${userId}.${role}.${expiresAtStr}`
    }

    const expectedSig = await computeHmac(payload)
    if (signature !== expectedSig) return null

    const expiresAt = parseInt(expiresAtStr, 10)
    if (Date.now() > expiresAt) return null

    return { userId, role, expiresAt, authVersion }
  } catch {
    return null
  }
}
