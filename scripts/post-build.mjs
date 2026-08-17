// scripts/post-build.mjs
// FE-044 (FRONTEND-16): paso post-build multiplataforma.
// Reemplaza `cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`
// que solo funciona en Unix. Usa fs.cp() de Node.js (disponible desde Node 16.7+).
//
// Este script se ejecuta automáticamente tras `next build` via el script
// "build" en package.json: `next build && node scripts/post-build.mjs`.

import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(__dirname, '..')

const standaloneDir = join(projectRoot, '.next', 'standalone')
const staticSrc = join(projectRoot, '.next', 'static')
const staticDst = join(standaloneDir, '.next', 'static')
const publicSrc = join(projectRoot, 'public')
const publicDst = join(standaloneDir, 'public')

// Verificar que .next/standalone existe (next build con output: standalone)
if (!existsSync(standaloneDir)) {
  console.error('[post-build] Error: .next/standalone no existe. ¿Está "output: standalone" en next.config.ts?')
  process.exit(1)
}

// Copiar .next/static → .next/standalone/.next/static
if (existsSync(staticSrc)) {
  // Crear .next/standalone/.next/ si no existe
  mkdirSync(join(standaloneDir, '.next'), { recursive: true })
  cpSync(staticSrc, staticDst, { recursive: true })
  console.log('[post-build] ✓ .next/static copiado a standalone')
} else {
  console.warn('[post-build] ⚠ .next/static no existe — saltando')
}

// Copiar public/ → .next/standalone/public/
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDst, { recursive: true })
  console.log('[post-build] ✓ public/ copiado a standalone')
} else {
  console.warn('[post-build] ⚠ public/ no existe — saltando')
}

console.log('[post-build] ✓ Build completo. Usar: bun run start o node .next/standalone/server.js')
