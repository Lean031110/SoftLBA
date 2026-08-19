// scripts/collect-diagnostics.mjs
// FASE 6 — Bundle sanitizado para enviar a IA/soporte.
//
// Empaqueta:
//   - logs/ (con redacción de secretos).
//   - diagnostics/ (doctor, turbopack-issues, etc.).
//   - package.json (sin secretos).
//   - mini-services/realtime-service/package.json.
//   - .env.example (no .env).
//   - prisma/schema.prisma (esquema, NO datos).
//   - next.config.ts.
//   - tsconfig.json.
//   - vitest.config.ts.
//   - eslint.config.mjs.
//   - public/manifest.json + public/sw.js (con SW_VERSION).
//   - system-info.json (Node/Bun/platform/env + git info + version info).
//   - Si --include-db-schema: ya incluye schema.prisma (default).
//
// NUNCA incluye:
//   - .env (variables con secretos).
//   - db/*.db (base de datos completa).
//   - backups/ (backups privados).
//   - cookies, tokens, contraseñas (redactados).
//
// Uso:
//   bun run collect:diagnostics
//   bun run collect:diagnostics -- --include-db-schema
//   bun run support:bundle   (alias, mismo comportamiento)

import { execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  rmSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const isSupportBundle = args.includes('--support')
const includeDbSchema = args.includes('--include-db-schema') || isSupportBundle

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
const prefix = isSupportBundle ? 'SoftLBA-support-bundle' : 'SoftLBA-diagnostics'
const bundleName = `${prefix}-${stamp}`
const STAGING = join(ROOT, 'diagnostics-staging', bundleName)
const BUNDLE_DIR = join(STAGING, bundleName)

mkdirSync(BUNDLE_DIR, { recursive: true })

console.log(`📦 Creando ${isSupportBundle ? 'support bundle' : 'diagnostics bundle'}...`)
console.log(`   Staging: ${STAGING}`)
console.log('')

// === Helpers ==================================================

const SECRET_PATTERNS = [
  { regex: /NEXTAUTH_SECRET\s*=\s*[^\n]+/g, replacement: 'NEXTAUTH_SECRET=[REDACTED]' },
  { regex: /REALTIME_SECRET\s*=\s*[^\n]+/g, replacement: 'REALTIME_SECRET=[REDACTED]' },
  { regex: /DATABASE_URL\s*=\s*[^\n]+/g, replacement: 'DATABASE_URL=[REDACTED]' },
  { regex: /password\s*[:=]\s*["'][^"']+["']/gi, replacement: 'password=[REDACTED]' },
  { regex: /token\s*[:=]\s*["'][^"']+["']/gi, replacement: 'token=[REDACTED]' },
  { regex: /cookie\s*[:=]\s*["'][^"']+["']/gi, replacement: 'cookie=[REDACTED]' },
  { regex: /authorization\s*[:=]\s*["'][^"']+["']/gi, replacement: 'authorization=[REDACTED]' },
  { regex: /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g, replacement: 'Bearer [REDACTED]' },
  { regex: /eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, replacement: '[REDACTED_JWT]' },
  { regex: /:\/\/[^:\/]+:[^@]+@/g, replacement: '://[REDACTED_USER]:[REDACTED_PASS]@' },
]

function redactContent(content) {
  let result = content
  for (const { regex, replacement } of SECRET_PATTERNS) {
    result = result.replace(regex, replacement)
  }
  return result
}

function safeCopyFile(srcPath, destPath, opts = {}) {
  if (!existsSync(srcPath)) return false
  try {
    let content = readFileSync(srcPath, 'utf8')
    if (opts.redact !== false) {
      content = redactContent(content)
    }
    writeFileSync(destPath, content)
    return true
  } catch {
    // Binario: copiar directo sin redactar.
    try {
      copyFileSync(srcPath, destPath)
      return true
    } catch {
      return false
    }
  }
}

function safeCopyDir(srcDir, destDir, opts = {}) {
  if (!existsSync(srcDir)) return 0
  mkdirSync(destDir, { recursive: true })
  let count = 0
  const entries = readdirSync(srcDir)
  for (const entry of entries) {
    const srcPath = join(srcDir, entry)
    const destPath = join(destDir, entry)
    const stat = statSync(srcPath)
    if (stat.isDirectory()) {
      count += safeCopyDir(srcPath, destPath, opts)
    } else {
      // Filtrar archivos enormes (>10MB) y binarios no-log.
      if (stat.size > 10 * 1024 * 1024) continue
      if (safeCopyFile(srcPath, destPath, opts)) count++
    }
  }
  return count
}

// === Copiar contenido ==========================================

let fileCount = 0

// 1. logs/ (redactado)
const logsSrc = join(ROOT, 'logs')
if (existsSync(logsSrc)) {
  fileCount += safeCopyDir(logsSrc, join(BUNDLE_DIR, 'logs'))
}

// 2. diagnostics/
const diagSrc = join(ROOT, 'diagnostics')
if (existsSync(diagSrc)) {
  fileCount += safeCopyDir(diagSrc, join(BUNDLE_DIR, 'diagnostics'))
}

// 3. package.json
if (safeCopyFile(join(ROOT, 'package.json'), join(BUNDLE_DIR, 'package.json'))) fileCount++

// 4. mini-services/realtime-service/package.json
mkdirSync(join(BUNDLE_DIR, 'mini-services', 'realtime-service'), { recursive: true })
if (safeCopyFile(
  join(ROOT, 'mini-services', 'realtime-service', 'package.json'),
  join(BUNDLE_DIR, 'mini-services', 'realtime-service', 'package.json'),
)) fileCount++

// 5. .env.example (no contiene secretos reales)
if (safeCopyFile(join(ROOT, '.env.example'), join(BUNDLE_DIR, '.env.example'))) fileCount++

// 6. .env NUNCA se incluye.

// 7. prisma/schema.prisma (siempre)
mkdirSync(join(BUNDLE_DIR, 'prisma'), { recursive: true })
if (safeCopyFile(join(ROOT, 'prisma', 'schema.prisma'), join(BUNDLE_DIR, 'prisma', 'schema.prisma'))) fileCount++

// 8. next.config.ts
if (safeCopyFile(join(ROOT, 'next.config.ts'), join(BUNDLE_DIR, 'next.config.ts'))) fileCount++

// 9. tsconfig.json
if (safeCopyFile(join(ROOT, 'tsconfig.json'), join(BUNDLE_DIR, 'tsconfig.json'))) fileCount++

// 10. vitest.config.ts
if (safeCopyFile(join(ROOT, 'vitest.config.ts'), join(BUNDLE_DIR, 'vitest.config.ts'))) fileCount++

// 11. eslint.config.mjs
if (safeCopyFile(join(ROOT, 'eslint.config.mjs'), join(BUNDLE_DIR, 'eslint.config.mjs'))) fileCount++

// 12. public/manifest.json + public/sw.js
mkdirSync(join(BUNDLE_DIR, 'public'), { recursive: true })
if (safeCopyFile(join(ROOT, 'public', 'manifest.json'), join(BUNDLE_DIR, 'public', 'manifest.json'))) fileCount++
if (safeCopyFile(join(ROOT, 'public', 'sw.js'), join(BUNDLE_DIR, 'public', 'sw.js'))) fileCount++

// 13. README.md (sin secretos, pero redactado por si acaso)
if (safeCopyFile(join(ROOT, 'README.md'), join(BUNDLE_DIR, 'README.md'))) fileCount++

// 14. CHANGELOG.md
if (safeCopyFile(join(ROOT, 'CHANGELOG.md'), join(BUNDLE_DIR, 'CHANGELOG.md'))) fileCount++

// 15. docs/PLAN_POS_PRODUCCION.md
if (existsSync(join(ROOT, 'docs'))) {
  fileCount += safeCopyDir(join(ROOT, 'docs'), join(BUNDLE_DIR, 'docs'))
}

// === System info ==============================================

let gitInfo = {}
try {
  gitInfo = {
    head: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
    shortHead: execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
    branch: execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
    status: execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim(),
    lastCommit: execSync('git log -1 --pretty=format:%s', { cwd: ROOT, encoding: 'utf8' }).trim(),
    tags: execSync('git tag --sort=-creatordate | head -5', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n'),
  }
} catch {
  /* ignore */
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

const systemInfo = {
  timestamp: new Date().toISOString(),
  bundleType: isSupportBundle ? 'support' : 'diagnostics',
  includeDbSchema,
  fileCount,
  system: {
    node: process.versions.node,
    bun: (() => { try { return execSync('bun --version', { encoding: 'utf8' }).trim() } catch { return null } })(),
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV || 'development',
  },
  versions: {
    package: pkg.version,
    name: pkg.name,
    dependencies: {
      next: pkg.dependencies?.next,
      prisma: pkg.dependencies?.prisma,
      '@prisma/client': pkg.dependencies?.['@prisma/client'],
      'socket.io': pkg.dependencies?.['socket.io'],
      'socket.io-client': pkg.dependencies?.['socket.io-client'],
      'z-ai-web-dev-sdk': pkg.dependencies?.['z-ai-web-dev-sdk'],
    },
    devDependencies: {
      typescript: pkg.devDependencies?.typescript,
      vitest: pkg.devDependencies?.vitest,
      '@playwright/test': pkg.devDependencies?.['@playwright/test'],
    },
  },
  git: gitInfo,
}

writeFileSync(join(BUNDLE_DIR, 'system-info.json'), JSON.stringify(systemInfo, null, 2))

// === Crear tar.gz ==============================================

const tarPath = join(ROOT, 'download')
mkdirSync(tarPath, { recursive: true })
const tarball = join(tarPath, `${bundleName}.tar.gz`)

try {
  // Tar desde dentro de staging para que el path sea limpio.
  execSync(`tar -czf "${tarball}" -C "${STAGING}" "${bundleName}"`)
  const size = statSync(tarball).size
  console.log(`✅ Bundle creado: ${tarball}`)
  console.log(`   Tamaño: ${(size / 1024).toFixed(1)} KB`)
  console.log(`   Archivos: ${fileCount}`)
} catch (e) {
  console.log(`❌ Error creando tar.gz: ${e.message}`)
  process.exit(1)
}

// Limpieza staging
try {
  rmSync(STAGING, { recursive: true, force: true })
} catch {
  /* ignore */
}

// === Validación de seguridad ====================================

console.log('')
console.log('🔒 Validación de seguridad (busca secretos en el bundle):')

const secretPatterns = [
  /NEXTAUTH_SECRET\s*=\s*[^\[]/i,
  /REALTIME_SECRET\s*=\s*[^\[]/i,
  /password\s*[:=]\s*["'][^"']+["']/i,
  /token\s*[:=]\s*["'][^"']+["']/i,
  /cookie\s*[:=]\s*["'][^"']+["']/i,
  /Bearer\s+[A-Za-z0-9]/,
]

let leakedSecrets = 0
try {
  const verify = execSync(`tar -xzOf "${tarball}" 2>/dev/null | grep -Ei "${secretPatterns.map(p => p.source).join('|')}" | head -20`, { encoding: 'utf8' }).trim()
  if (verify) {
    console.log('   ⚠️  Posibles secretos NO redactados encontrados:')
    console.log(verify.split('\n').slice(0, 10).join('\n'))
    leakedSecrets = verify.split('\n').length
  } else {
    console.log('   ✅ Sin secretos NO redactados.')
  }
} catch (e) {
  // grep sin resultados = exit 1, no es error.
  console.log('   ✅ Sin secretos NO redactados.')
}

if (leakedSecrets > 0) {
  console.log('')
  console.log(`⚠️  ${leakedSecrets} líneas con posibles secretos. Revisa manualmente antes de enviar.`)
}

console.log('')
console.log(`> Bundle listo para enviar a IA/soporte: ${tarball}`)
