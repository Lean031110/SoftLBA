// ============================================================
// URL validation helper (issue #95)
// ------------------------------------------------------------
// FASE 12 (v1.0.13)
//
// Validación estricta de URLs en campos de configuración que se usan
// como enlaces o fuentes (logo, website, facebook, instagram, telegram, etc.).
//
// Problema:
//   Antes los campos eran strings libres. Un admin (o un atacante que
//   comprometiera la cuenta admin) podía setear:
//     website: "javascript:alert(document.cookie)"
//   Esto generaría un enlace <a href="javascript:..."> que ejecuta JS
//   arbitrario en el navegador de cualquier visitante (XSS stored).
//
// Solución:
//   - Aceptar solo http:// y https://.
//   - Rechazar javascript:, data:, vbscript:, file:, etc.
//   - Validar que la URL parsea correctamente con new URL().
// ============================================================

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Valida que una URL sea segura (http/https solamente).
 * Retorna null si es válida, o un mensaje de error si no.
 */
export function validateUrl(url: string | null | undefined): string | null {
  if (!url || url.trim() === '') return null

  const trimmed = url.trim()

  if (/[\s\x00-\x1f]/.test(trimmed)) {
    return 'La URL contiene caracteres inválidos (espacios o controles).'
  }

  try {
    const parsed = new URL(trimmed)
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return `Protocolo no permitido: ${parsed.protocol}. Solo se permite http:// y https://.`
    }
    if (!parsed.hostname) {
      return 'La URL debe tener un hostname válido.'
    }
    return null
  } catch {
    return 'URL inválida. Debe incluir protocolo (http:// o https://) y host.'
  }
}

/**
 * Valida múltiples URLs y retorna el primer error encontrado, o null si todas son válidas.
 */
export function validateUrls(
  urls: Record<string, string | null | undefined>,
): { field: string; error: string } | null {
  for (const [field, value] of Object.entries(urls)) {
    const error = validateUrl(value)
    if (error) {
      return { field, error }
    }
  }
  return null
}

/**
 * Sanitiza una URL: si es inválida, retorna null.
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || url.trim() === '') return null
  try {
    const parsed = new URL(url.trim())
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null
    if (!parsed.hostname) return null
    parsed.username = ''
    parsed.password = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}
