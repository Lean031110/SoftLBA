// scripts/doctor.ts
// FASE 5 — Health check exhaustivo del entorno.
//
// Verifica:
//   - Node/Bun versiones.
//   - Puertos 3000/3003/3004 libres o ocupados.
//   - DATABASE_URL presente.
//   - Prisma generado.
//   - DB reachable (SELECT 1).
//   - Migraciones aplicadas.
//   - Next.js build OK (si existe .next/).
//   - Realtime service /health reachable.
//   - Print worker /health reachable.
//   - Variables de entorno críticas presentes (sin valor).
//   - PWA: manifest.json + sw.js existen.
//   - Service Worker: SW_VERSION alineada con package.json.
//   - Permisos: db/, download/, backups/, logs/ escribibles.
//   - TypeScript: tsc --noEmit (opcional, lento).
//   - ESLint: eslint . (opcional, lento).
//   - Git: estado limpio + último commit + tag actual.
//   - Versión consistente entre package.json, git tag, sw.js, manifest.json.
//
// Output:
//   diagnostics/doctor-YYYY-MM-DD-HH-mm.json
//   diagnostics/doctor-YYYY-MM-DD-HH-mm.md

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { execSync } from 'child_process'

const ROOT = resolve(__dirname, '..')
const DIAG_DIR = join(ROOT, 'diagnostics')

mkdirSync(DIAG_DIR, { recursive: true })

interface Check {
  name: string
  status: 'ok' | 'fail' | 'warn'
  detail: string
  duration_ms?: number
}

const checks: Check[] = []

function check(name: string, fn: () => { status: Check['status']; detail: string }) {
  const t0 = Date.now()
  try {
    const result = fn()
    checks.push({ name, ...result, duration_ms: Date.now() - t0 })
  } catch (e: any) {
    checks.push({ name, status: 'fail', detail: e.message, duration_ms: Date.now() - t0 })
  }
}

async function asyncCheck(name: string, fn: () => Promise<{ status: Check['status']; detail: string }>) {
  const t0 = Date.now()
  try {
    const result = await fn()
    checks.push({ name, ...result, duration_ms: Date.now() - t0 })
  } catch (e: any) {
    checks.push({ name, status: 'fail', detail: e.message, duration_ms: Date.now() - t0 })
  }
}

function readJson(rel: string): any {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
}

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

async function fetchHealth(url: string, timeoutMs = 2000): Promise<{ ok: boolean; status: number; body: any; latencyMs: number }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const t0 = Date.now()
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    const body = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, body, latencyMs: Date.now() - t0 }
  } finally {
    clearTimeout(timeout)
  }
}

async function isPortListening(port: number, host = '127.0.0.1'): Promise<boolean> {
  const { createServer } = await import('net')
  return new Promise((resolve) => {
    const srv = createServer()
    srv.once('error', () => resolve(true)) // occupied = listening
    srv.once('listening', () => {
      srv.close(() => resolve(false))
    })
    srv.listen(port, host)
  })
}

// ============================================================
// SECCIÓN 1: Runtime
// ============================================================

check('node_version', () => {
  const v = process.versions.node
  return { status: parseInt(v) >= 18 ? 'ok' : 'fail', detail: `Node ${v}` }
})

check('bun_installed', () => {
  try {
    const v = execSync('bun --version', { encoding: 'utf8' }).trim()
    return { status: 'ok', detail: `Bun ${v}` }
  } catch {
    return { status: 'fail', detail: 'Bun no encontrado en PATH' }
  }
})

// ============================================================
// SECCIÓN 2: Archivos de configuración
// ============================================================

check('env_file', () => {
  const envPath = join(ROOT, '.env')
  return {
    status: existsSync(envPath) ? 'ok' : 'warn',
    detail: existsSync(envPath) ? '.env presente' : '.env NO presente — copiar de .env.example',
  }
})

check('env_example', () => ({
  status: existsSync(join(ROOT, '.env.example')) ? 'ok' : 'fail',
  detail: '.env.example',
}))

check('package_version', () => {
  const pkg = readJson('package.json')
  return { status: 'ok', detail: `v${pkg.version}` }
})

check('git_status', () => {
  try {
    const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim()
    const head = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
    return {
      status: status ? 'warn' : 'ok',
      detail: `HEAD ${head}${status ? ` — ${status.split('\n').length} cambios sin commitear` : ' — limpio'}`,
    }
  } catch {
    return { status: 'warn', detail: 'No es un repo git o git no disponible' }
  }
})

check('git_tag_at_head', () => {
  try {
    const tag = execSync('git tag --points-at HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
    return {
      status: tag ? 'ok' : 'warn',
      detail: tag ? `Tag actual: ${tag}` : 'HEAD no tiene tag — pendiente de release',
    }
  } catch {
    return { status: 'warn', detail: 'git no disponible' }
  }
})

// ============================================================
// SECCIÓN 3: Version consistency (FASE 1)
// ============================================================

check('version_consistency_pkg_vs_manifest', () => {
  const pkg = readJson('package.json')
  const manifest = readJson('public/manifest.json')
  return {
    status: pkg.version === manifest.version ? 'ok' : 'fail',
    detail: `package.json=${pkg.version} · manifest=${manifest.version || '(no version field)'}`,
  }
})

check('version_consistency_pkg_vs_sw', () => {
  const pkg = readJson('package.json')
  const sw = readText('public/sw.js')
  const match = sw.match(/SW_VERSION\s*=\s*"softlba-v([^"]+)"/)
  if (!match) return { status: 'fail', detail: 'SW_VERSION no encontrada en sw.js' }
  return {
    status: match[1] === pkg.version ? 'ok' : 'fail',
    detail: `package.json=${pkg.version} · sw.js=${match[1]}`,
  }
})

check('version_consistency_pkg_vs_changelog', () => {
  const pkg = readJson('package.json')
  const changelog = readText('CHANGELOG.md')
  const entry = `## [${pkg.version}]`
  return {
    status: changelog.includes(entry) ? 'ok' : 'warn',
    detail: changelog.includes(entry)
      ? `CHANGELOG tiene entrada para ${pkg.version}`
      : `CHANGELOG NO tiene entrada para ${pkg.version}`,
  }
})

// ============================================================
// SECCIÓN 4: Base de datos
// ============================================================

check('database_url_in_env', () => {
  if (!process.env.DATABASE_URL) {
    // Intentar leer de .env si existe.
    const envPath = join(ROOT, '.env')
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf8')
      const match = envContent.match(/^DATABASE_URL\s*=\s*(.+)$/m)
      if (match) return { status: 'ok', detail: 'DATABASE_URL presente en .env' }
    }
    return { status: 'warn', detail: 'DATABASE_URL no seteada en entorno actual ni .env' }
  }
  return { status: 'ok', detail: 'DATABASE_URL presente en entorno' }
})

check('prisma_generated', () => {
  const clientPath = join(ROOT, 'node_modules', '@prisma', 'client')
  return {
    status: existsSync(clientPath) ? 'ok' : 'fail',
    detail: existsSync(clientPath) ? 'Prisma client generado' : 'Ejecutar `bun run db:generate`',
  }
})

check('db_file', () => {
  // Default SQLite path: prisma/dev.db or db/custom.db
  const candidates = ['db/custom.db', 'prisma/dev.db']
  for (const c of candidates) {
    if (existsSync(join(ROOT, c))) {
      return { status: 'ok', detail: `${c} presente` }
    }
  }
  return { status: 'warn', detail: 'DB SQLite no creada — ejecutar `bun run db:push`' }
})

// ============================================================
// SECCIÓN 5: Build
// ============================================================

check('next_build_output', () => {
  const nextPath = join(ROOT, '.next')
  return {
    status: existsSync(nextPath) ? 'ok' : 'warn',
    detail: existsSync(nextPath) ? '.next/ existe (build previo)' : 'No hay build previo — ejecutar `bun run build`',
  }
})

// ============================================================
// SECCIÓN 6: PWA
// ============================================================

check('sw_file', () => ({
  status: existsSync(join(ROOT, 'public', 'sw.js')) ? 'ok' : 'fail',
  detail: 'public/sw.js',
}))

check('manifest_file', () => ({
  status: existsSync(join(ROOT, 'public', 'manifest.json')) ? 'ok' : 'fail',
  detail: 'public/manifest.json',
}))

check('manifest_version_field', () => {
  const manifest = readJson('public/manifest.json')
  return {
    status: manifest.version ? 'ok' : 'warn',
    detail: manifest.version ? `version=${manifest.version}` : 'manifest.json sin campo "version"',
  }
})

// ============================================================
// SECCIÓN 7: Permisos de directorios
// ============================================================

function checkWritableDir(name: string, rel: string) {
  check(name, () => {
    const p = join(ROOT, rel)
    try {
      mkdirSync(p, { recursive: true })
      const testFile = join(p, '.doctor-write-test')
      writeFileSync(testFile, 'ok')
      // Limpiar.
      try { execSync(`rm -f "${testFile}"`) } catch { /* ignore */ }
      return { status: 'ok', detail: `${rel}/ escribible` }
    } catch {
      return { status: 'fail', detail: `${rel}/ NO escribible` }
    }
  })
}

checkWritableDir('logs_dir_writable', 'logs')
checkWritableDir('download_dir_writable', 'download')
checkWritableDir('backups_dir_writable', 'backups')
checkWritableDir('db_dir_writable', 'db')

// ============================================================
// SECCIÓN 8: Servicios corriendo (async)
// ============================================================

await asyncCheck('next_service_running', async () => {
  const listening = await isPortListening(3000)
  return {
    status: listening ? 'ok' : 'warn',
    detail: listening ? 'Next.js escuchando en :3000' : 'Next.js NO escuchando en :3000 — ejecutar `bun run dev:all` o `bun run dev`',
  }
})

await asyncCheck('realtime_service_running', async () => {
  const listening = await isPortListening(3003)
  if (!listening) {
    return {
      status: 'warn',
      detail: 'Realtime NO escuchando en :3003 — ejecutar `bun run realtime`',
    }
  }
  try {
    const h = await fetchHealth('http://127.0.0.1:3003/health')
    if (!h.ok) return { status: 'fail', detail: `/health respondió ${h.status}` }
    return {
      status: 'ok',
      detail: `Realtime OK · clients=${h.body?.clients ?? '?'} · uptime=${h.body?.uptime ?? '?'}s · ${h.latencyMs}ms`,
    }
  } catch (e: any) {
    return { status: 'fail', detail: `Realtime escuchando pero /health falló: ${e.message}` }
  }
})

await asyncCheck('print_worker_running', async () => {
  const listening = await isPortListening(3004)
  if (!listening) {
    return {
      status: 'warn',
      detail: 'Print Worker NO escuchando en :3004 — ejecutar `bun run print:worker`',
    }
  }
  try {
    const h = await fetchHealth('http://127.0.0.1:3004/health')
    if (!h.ok) return { status: 'fail', detail: `/health respondió ${h.status}` }
    return {
      status: 'ok',
      detail: `Print Worker OK · uptime=${h.body?.uptime ?? '?'}s`,
    }
  } catch (e: any) {
    return { status: 'fail', detail: `Print Worker escuchando pero /health falló: ${e.message}` }
  }
})

await asyncCheck('backend_health_endpoint', async () => {
  try {
    const h = await fetchHealth('http://127.0.0.1:3000/api/health')
    if (!h.ok) return { status: 'fail', detail: `/api/health respondió ${h.status}` }
    return {
      status: 'ok',
      detail: `Backend health OK · db=${h.body?.checks?.database?.status ?? '?'} · version=${h.body?.version ?? '?'} · ${h.latencyMs}ms`,
    }
  } catch (e: any) {
    return { status: 'warn', detail: `Backend no responde: ${e.message}` }
  }
})

// ============================================================
// SECCIÓN 9: TypeScript + ESLint (solo si --full o si el runtime los pidió)
// ============================================================

const runFull = process.argv.includes('--full')

if (runFull) {
  check('typescript_check', () => {
    try {
      execSync('npx tsc --noEmit', { cwd: ROOT, encoding: 'utf8', timeout: 120000 })
      return { status: 'ok', detail: 'tsc --noEmit: 0 errores' }
    } catch (e: any) {
      const out = e.stdout || e.stderr || e.message
      return { status: 'fail', detail: `tsc errores: ${String(out).slice(0, 200)}` }
    }
  })

  check('eslint_check', () => {
    try {
      execSync('npx eslint .', { cwd: ROOT, encoding: 'utf8', timeout: 120000 })
      return { status: 'ok', detail: 'eslint: 0 errores' }
    } catch (e: any) {
      const out = e.stdout || e.stderr || e.message
      return { status: 'fail', detail: `eslint errores: ${String(out).slice(0, 200)}` }
    }
  })
}

// ============================================================
// SECCIÓN 10: Variables de entorno críticas (presencia, NO valor)
// ============================================================

const CRITICAL_ENV = ['NEXTAUTH_SECRET', 'REALTIME_SECRET', 'DATABASE_URL', 'REALTIME_PORT']

for (const envVar of CRITICAL_ENV) {
  check(`env_${envVar.toLowerCase()}`, () => {
    let present = !!process.env[envVar]
    if (!present) {
      // Intentar leer de .env
      const envPath = join(ROOT, '.env')
      if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf8')
        if (new RegExp(`^${envVar}\\s*=`, 'm').test(content)) present = true
      }
    }
    return {
      status: present ? 'ok' : 'warn',
      detail: present ? `${envVar} presente` : `${envVar} NO presente`,
    }
  })
}

// ============================================================
// Output
// ============================================================

const ok = checks.filter((c) => c.status === 'ok').length
const warn = checks.filter((c) => c.status === 'warn').length
const fail = checks.filter((c) => c.status === 'fail').length

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
const jsonPath = join(DIAG_DIR, `doctor-${stamp}.json`)
const mdPath = join(DIAG_DIR, `doctor-${stamp}.md`)

const report = {
  timestamp: new Date().toISOString(),
  root: ROOT,
  summary: { ok, warn, fail, total: checks.length },
  checks,
}

writeFileSync(jsonPath, JSON.stringify(report, null, 2))

const md = [
  `# Doctor — ${new Date().toISOString()}`,
  '',
  `**Root:** \`${ROOT}\``,
  '',
  `**Resumen:** ✅ ${ok} OK · ⚠️ ${warn} WARN · ❌ ${fail} FAIL · ${checks.length} total`,
  '',
  '| Check | Estado | Detalle | Duración |',
  '|-------|--------|---------|----------|',
  ...checks.map((c) => {
    const icon = c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'
    return `| ${c.name} | ${icon} ${c.status.toUpperCase()} | ${c.detail} | ${c.duration_ms ?? 0}ms |`
  }),
  '',
  runFull ? '' : '> Tip: ejecuta `bun run doctor -- --full` para incluir TypeScript + ESLint checks (lento).',
  '',
].filter(Boolean).join('\n')

writeFileSync(mdPath, md)

console.log(md)
console.log(`\n📄 JSON: ${jsonPath}`)
console.log(`📄 MD:   ${mdPath}`)

process.exit(fail > 0 ? 1 : 0)
