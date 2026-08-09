#!/usr/bin/env bun
// ============================================================
// Script de backup - crea un backup de la base de datos
// y comprime todo el proyecto en un .tar.gz
// ============================================================

import { execSync } from 'child_process'
import { existsSync, mkdirSync, copyFileSync, statSync, createWriteStream, readdirSync } from 'fs'
import { join } from 'path'
import { createGzip } from 'zlib'
import { createTar } from 'tar'

const ROOT = '/home/z/my-project'
const DB_PATH = join(ROOT, 'db/custom.db')
const BACKUP_DIR = join(ROOT, 'backups')

// Crear directorio si no existe
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true })
}

const now = new Date()
const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
const version = process.argv[2] || 'snapshot'
const dbBackupPath = join(BACKUP_DIR, `db-${ts}.db`)
const projectTarPath = join(BACKUP_DIR, `proyecto-${version}-${ts}.tar.gz`)

console.log(`📦 Creando backup v${version} (${ts})...`)

// 1. Copiar base de datos
if (existsSync(DB_PATH)) {
  copyFileSync(DB_PATH, dbBackupPath)
  console.log(`  ✓ Base de datos copiada: ${dbBackupPath}`)
} else {
  console.log('  ⚠ No se encontró la base de datos en', DB_PATH)
}

// 2. Crear tar.gz del proyecto (excluyendo node_modules, .next, etc.)
console.log(`  → Comprimiendo proyecto en ${projectTarPath}...`)
try {
  execSync(`tar -czf "${projectTarPath}" \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='backups' \
    --exclude='dev.log' \
    --exclude='server.log' \
    --exclude='*.log' \
    -C /home/z my-project`, { stdio: 'inherit' })
  console.log(`  ✓ Proyecto comprimido`)
} catch (e) {
  console.error('  ✗ Error al comprimir:', e)
  process.exit(1)
}

// 3. Mostrar tamaño
if (existsSync(projectTarPath)) {
  const size = statSync(projectTarPath).size
  const mb = (size / 1024 / 1024).toFixed(2)
  console.log(`  ✓ Tamaño: ${mb} MB`)
}

console.log('')
console.log('✅ Backup completado:')
console.log(`   DB:     ${dbBackupPath}`)
console.log(`   Proyecto: ${projectTarPath}`)
