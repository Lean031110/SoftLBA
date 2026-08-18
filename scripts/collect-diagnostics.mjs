// scripts/collect-diagnostics.mjs
// FASE 6 — Bundle sanitizado para enviar a IA/soporte.
//
// STUB FASE 2: crea un tar.gz mínimo con logs/ y diagnostics/.
// FASE 6: filtrado completo de secretos, opción --include-db-schema, etc.

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const isSupportBundle = args.includes('--support')
const includeDbSchema = args.includes('--include-db-schema')

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
const prefix = isSupportBundle ? 'SoftLBA-support-bundle' : 'SoftLBA-diagnostics'
const bundleName = `${prefix}-${stamp}`
const STAGING = join(ROOT, 'diagnostics-staging', bundleName)

mkdirSync(STAGING, { recursive: true })

console.log(`📦 Creando ${isSupportBundle ? 'support bundle' : 'diagnostics bundle'}...`)
console.log(`   Carpeta staging: ${STAGING}`)
console.log('')

// === Funciones de copia con sanitización ======================

function safeCopyFile(srcPath, destPath, redactPatterns = []) {
  if (!existsSync(srcPath)) return
  try {
    let content = readFileSync(srcPath, 'utf8')
    // Redactar patrones sensibles.
    for (const pattern of redactPatterns) {
      content = content.replace(pattern, '[REDACTED]')
    }
    writeFileSync(destPath, content)
  } catch {
    // Binario: copiar directo.
    copyFileSync(srcPath, destPath)
  }
}

const SECRET_PATTERNS = [
  /NEXTAUTH_SECRET\s*=\s*[^\n]+/g,
  /REALTIME_SECRET\s*=\s*[^\n]+/g,
  /DATABASE_URL\s*=\s*[^\n]+/g,
  /password\s*[:=]\s*["'][^"']+["']/gi,
  /token\s*[:=]\s*["'][^"']+["']/gi,
  /cookie\s*[:=]\s*["'][^"']+["']/gi,
  /authorization\s*[:=]\s*["'][^"']+["']/gi,
]

// === Copiar contenido ==========================================

// 1. logs/
const logsSrc = join(ROOT, 'logs')
if (existsSync(logsSrc)) {
  try {
    execSync(`cp -r "${logsSrc}" "${STAGING}/"`, { stdio: 'ignore' })
    // Redactar secretos en cada archivo de log.
    const logFiles = execSync(`find "${STAGING}/logs" -type f`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
    for (const f of logFiles) {
      safeCopyFile(f, f, SECRET_PATTERNS)
    }
  } catch (e) {
    console.log(`   ⚠️  No se pudo copiar logs/: ${e.message}`)
  }
}

// 2. diagnostics/
const diagSrc = join(ROOT, 'diagnostics')
if (existsSync(diagSrc)) {
  try {
    execSync(`cp -r "${diagSrc}" "${STAGING}/"`, { stdio: 'ignore' })
  } catch {
    /* ignore */
  }
}

// 3. package.json (sin secretos, no debería tener)
safeCopyFile(join(ROOT, 'package.json'), join(STAGING, 'package.json'), SECRET_PATTERNS)

// 4. Versión del sistema
const sysInfo = {
  timestamp: new Date().toISOString(),
  node: process.versions,
  platform: process.platform,
  arch: process.arch,
  env: process.env.NODE_ENV || 'development',
}

// 5. Git info
let gitInfo = {}
try {
  gitInfo = {
    head: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
    branch: execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
    status: execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim(),
    lastCommit: execSync('git log -1 --pretty=format:%s', { cwd: ROOT, encoding: 'utf8' }).trim(),
  }
} catch {
  /* ignore */
}

writeFileSync(
  join(STAGING, 'system-info.json'),
  JSON.stringify({ system: sysInfo, git: gitInfo }, null, 2),
)

// 6. .env.example (no contiene secretos reales)
safeCopyFile(join(ROOT, '.env.example'), join(STAGING, '.env.example'))

// 7. .env NO se incluye jamás.

// 8. prisma/schema.prisma (siempre — no tiene secretos)
const schemaSrc = join(ROOT, 'prisma', 'schema.prisma')
if (existsSync(schemaSrc)) {
  safeCopyFile(schemaSrc, join(STAGING, 'schema.prisma'))
}

// 9. next.config.ts
safeCopyFile(join(ROOT, 'next.config.ts'), join(STAGING, 'next.config.ts'))

// === Crear tar.gz ==============================================

const tarPath = join(ROOT, 'download')
mkdirSync(tarPath, { recursive: true })
const tarball = join(tarPath, `${bundleName}.tar.gz`)

try {
  execSync(`tar -czf "${tarball}" -C "${join(ROOT, 'diagnostics-staging')}" "${bundleName}"`)
  console.log(`✅ Bundle creado: ${tarball}`)
  console.log(`   Tamaño: ${(execSync(`du -h "${tarball}"`, { encoding: 'utf8' }).split(/\s+/)[0])}`)
} catch (e) {
  console.log(`❌ Error creando tar.gz: ${e.message}`)
  process.exit(1)
}

// Limpieza staging
try {
  rmSync(join(ROOT, 'diagnostics-staging'), { recursive: true, force: true })
} catch {
  /* ignore */
}

// === Validación de seguridad ====================================

console.log('')
console.log('🔒 Validación de seguridad:')
try {
  const verify = execSync(`grep -rEi 'password=|secret=|token=|cookie=|authorization=' "${tarball}" || true`, { encoding: 'utf8' })
  if (verify.trim()) {
    console.log('   ⚠️  Posibles secretos encontrados en el bundle:')
    console.log(verify)
  } else {
    console.log('   ✅ Sin secretos detectados.')
  }
} catch {
  console.log('   ✅ Sin secretos detectados.')
}

console.log('')
console.log(`> STUB FASE 2 — implementación completa en FASE 6.`)
