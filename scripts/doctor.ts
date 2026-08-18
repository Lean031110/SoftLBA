// scripts/doctor.ts
// FASE 5 — Health check exhaustivo del entorno.
//
// STUB FASE 2: versión mínima que verifica lo esencial.
// FASE 5: implementación completa con todas las verificaciones del plan.

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
}

const checks: Check[] = []

function check(name: string, fn: () => { status: Check['status']; detail: string }) {
  try {
    const result = fn()
    checks.push({ name, ...result })
  } catch (e: any) {
    checks.push({ name, status: 'fail', detail: e.message })
  }
}

// === Checks básicos (FASE 2 stub) ==============================

check('node_version', () => {
  const v = process.versions.node
  return {
    status: parseInt(v) >= 18 ? 'ok' : 'fail',
    detail: `Node ${v}`,
  }
})

check('bun_installed', () => {
  try {
    const v = execSync('bun --version', { encoding: 'utf8' }).trim()
    return { status: 'ok', detail: `Bun ${v}` }
  } catch {
    return { status: 'fail', detail: 'Bun no encontrado en PATH' }
  }
})

check('env_file', () => {
  const envPath = join(ROOT, '.env')
  return {
    status: existsSync(envPath) ? 'ok' : 'warn',
    detail: existsSync(envPath) ? '.env presente' : '.env NO presente — copiar de .env.example',
  }
})

check('env_example', () => {
  return {
    status: existsSync(join(ROOT, '.env.example')) ? 'ok' : 'fail',
    detail: '.env.example',
  }
})

check('database_url_in_env', () => {
  if (!process.env.DATABASE_URL) return { status: 'warn', detail: 'DATABASE_URL no seteada en entorno actual' }
  return { status: 'ok', detail: 'DATABASE_URL presente' }
})

check('prisma_generated', () => {
  const clientPath = join(ROOT, 'node_modules', '@prisma', 'client')
  return {
    status: existsSync(clientPath) ? 'ok' : 'fail',
    detail: existsSync(clientPath) ? 'Prisma client generado' : 'Ejecutar `bun run db:generate`',
  }
})

check('db_file', () => {
  const dbPath = join(ROOT, 'db', 'custom.db')
  return {
    status: existsSync(dbPath) ? 'ok' : 'warn',
    detail: existsSync(dbPath) ? 'DB SQLite presente' : 'DB SQLite no creada — ejecutar `bun run db:push`',
  }
})

check('next_build_output', () => {
  const nextPath = join(ROOT, '.next')
  return {
    status: existsSync(nextPath) ? 'ok' : 'warn',
    detail: existsSync(nextPath) ? '.next/ existe (build previo)' : 'No hay build previo — ejecutar `bun run build`',
  }
})

check('sw_file', () => {
  return {
    status: existsSync(join(ROOT, 'public', 'sw.js')) ? 'ok' : 'fail',
    detail: 'public/sw.js',
  }
})

check('manifest_file', () => {
  return {
    status: existsSync(join(ROOT, 'public', 'manifest.json')) ? 'ok' : 'fail',
    detail: 'public/manifest.json',
  }
})

check('logs_dir_writable', () => {
  const logsPath = join(ROOT, 'logs')
  try {
    mkdirSync(logsPath, { recursive: true })
    return { status: 'ok', detail: 'logs/ escribible' }
  } catch {
    return { status: 'fail', detail: 'logs/ NO escribible' }
  }
})

check('download_dir_writable', () => {
  const dlPath = join(ROOT, 'download')
  try {
    mkdirSync(dlPath, { recursive: true })
    return { status: 'ok', detail: 'download/ escribible' }
  } catch {
    return { status: 'fail', detail: 'download/ NO escribible' }
  }
})

check('package_version', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
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

// === Output ====================================================

const ok = checks.filter((c) => c.status === 'ok').length
const warn = checks.filter((c) => c.status === 'warn').length
const fail = checks.filter((c) => c.status === 'fail').length

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
const jsonPath = join(DIAG_DIR, `doctor-${stamp}.json`)
const mdPath = join(DIAG_DIR, `doctor-${stamp}.md`)

const report = {
  timestamp: new Date().toISOString(),
  summary: { ok, warn, fail, total: checks.length },
  checks,
}

writeFileSync(jsonPath, JSON.stringify(report, null, 2))

const md = [
  `# Doctor — ${new Date().toISOString()}`,
  '',
  `**Resumen:** ✅ ${ok} OK · ⚠️ ${warn} WARN · ❌ ${fail} FAIL · ${checks.length} total`,
  '',
  '| Check | Estado | Detalle |',
  '|-------|--------|---------|',
  ...checks.map((c) => `| ${c.name} | ${c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'} ${c.status.toUpperCase()} | ${c.detail} |`),
  '',
  `> STUB FASE 2 — implementación completa en FASE 5.`,
].join('\n')

writeFileSync(mdPath, md)

console.log(md)
console.log(`\n📄 JSON: ${jsonPath}`)
console.log(`📄 MD:   ${mdPath}`)

process.exit(fail > 0 ? 1 : 0)
