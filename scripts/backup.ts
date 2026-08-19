// ============================================================
// Script de backup - SoftLBA
// Crea un archivo .tar.gz con SOLO el código fuente del proyecto
// (sin node_modules, sin .next, sin builds, sin logs, sin skills)
// y lo guarda en /home/z/my-project/download/salva/
// ============================================================

import { execSync } from 'child_process'
import { existsSync, mkdirSync, copyFileSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = '/home/z/my-project'
const DB_PATH = join(ROOT, 'db/custom.db')
const DOWNLOAD_DIR = join(ROOT, 'download')
const SALVA_DIR = join(DOWNLOAD_DIR, 'salva')
const BACKUP_DIR = join(ROOT, 'backups')

// Crear directorios si no existen
if (!existsSync(SALVA_DIR)) {
  mkdirSync(SALVA_DIR, { recursive: true })
  console.log(`  ✓ Creado directorio: ${SALVA_DIR}`)
}

const now = new Date()
const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
const version = process.argv[2] || 'snapshot'
const dbBackupPath = join(BACKUP_DIR, `db-${ts}.db`)
const projectTarPath = join(SALVA_DIR, `SoftLBA-v${version}-${ts}.tar.gz`)

console.log(`\n📦 Creando backup SoftLBA v${version} (${ts})...`)
console.log(`   Destino: ${projectTarPath}`)
console.log('')

// 1. Copiar base de datos (opcional, solo datos)
console.log('  → Copiando base de datos...')
if (existsSync(DB_PATH)) {
  copyFileSync(DB_PATH, dbBackupPath)
  console.log(`  ✓ Base de datos: ${dbBackupPath}`)
} else {
  console.log(`  ⚠ No se encontró la base de datos en ${DB_PATH}`)
}

// 2. Crear tar.gz con SOLO el código fuente
console.log('  → Comprimiendo SOLO código fuente (sin node_modules, sin builds)...')

const excludes = [
  'node_modules',
  '.next',
  '.git',
  'backups',
  'download',
  '.zscripts',
  'skills',
  'agent-ctx',
  'tests',
  'tool-results',
  'upload',
  'dev.log',
  'server.log',
  '*.log',
  '.DS_Store',
  '.env.local',
  '.env.production',
  'bun.lock',
  '*.db',
  '*.db-journal',
  '*.db-wal',
  '*.db-shm',
]

try {
  // Crear el tar en /tmp primero, luego mover (evita conflicto)
  const tmpTar = `/tmp/SoftLBA-tmp-${ts}.tar.gz`
  const excludeArgs = excludes.map(e => `--exclude='${e}'`).join(' ')
  execSync(`tar -czf "${tmpTar}" ${excludeArgs} -C /home/z/my-project .`, { stdio: 'inherit' })
  // Mover al destino final
  execSync(`mv "${tmpTar}" "${projectTarPath}"`)
  console.log(`  ✓ Código fuente comprimido`)
} catch (e) {
  console.error('  ✗ Error al comprimir:', e)
  process.exit(1)
}

// 3. Mostrar info del backup
if (existsSync(projectTarPath)) {
  const size = statSync(projectTarPath).size
  const mb = (size / 1024 / 1024).toFixed(2)
  console.log('')
  console.log(`  📦 Archivo: ${projectTarPath}`)
  console.log(`  📏 Tamaño: ${mb} MB`)
  console.log(`  🏷  Versión: v${version}`)
  console.log(`  📅 Fecha: ${now.toLocaleString('es-CU')}`)
}

// 4. Listar backups existentes en /download/salva/
console.log('')
console.log('🗂️  Backups en /download/salva/:')
try {
  const files = execSync(`ls -lh ${SALVA_DIR}/*.tar.gz 2>/dev/null`, { encoding: 'utf-8' })
  console.log(files)
} catch (e) {
  console.log('  (sin backups previos)')
}

// 5. Verificar contenido del backup
console.log('📊 Estadísticas del backup:')
try {
  const totalFiles = execSync(`tar -tzf "${projectTarPath}" | wc -l`, { encoding: 'utf-8' }).trim()
  console.log(`   Total archivos: ${totalFiles}`)
  const srcFiles = execSync(`tar -tzf "${projectTarPath}" | grep -E '\\.(ts|tsx|js|jsx|prisma|md|json|css|svg|png)$' | wc -l`, { encoding: 'utf-8' }).trim()
  console.log(`   Archivos de código: ${srcFiles}`)
} catch (e) {
  // ignore
}

console.log('✅ Backup completado correctamente')
