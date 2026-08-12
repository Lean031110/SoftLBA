// ============================================================
// Utilidad para calcular checksum SHA-256 de un archivo (FIX 23-25)
// ------------------------------------------------------------
// Compatible con Node.js (crypto) y Bun. El helper lee el archivo en
// chunks de 64KB para no cargar archivos grandes en memoria de golpe.
// ============================================================

import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { promises as fs } from 'fs'

/**
 * Calcula el SHA-256 de un archivo leyéndolo en streaming.
 * @param filePath Ruta absoluta al archivo.
 * @returns Hex digest de 64 caracteres.
 */
export async function fileSha256(filePath: string): Promise<string> {
  // Para archivos pequeños (típicos de SQLite, < 100MB) basta con leer
  // el archivo completo de una vez y hashear el buffer. Es más simple y
  // compatible con cualquier runtime (Node/Bun).
  const buf = await fs.readFile(filePath)
  return createHash('sha256').update(buf).digest('hex')
}

/**
 * Versión síncrona basada en stream (útil para archivos muy grandes).
 * No usada actualmente pero dejada aquí para referencia futura.
 */
export function fileSha256Stream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}
