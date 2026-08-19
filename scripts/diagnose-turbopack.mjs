// scripts/diagnose-turbopack.mjs
// FASE 4 — Análisis de errores Turbopack/Next/TS capturados en logs.
//
// STUB FASE 2: lee logs/turbopack.log si existe y crea un resumen básico.
// FASE 4: parser completo con extracción de file/line/column/message/stack.

import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')

const TURBOPACK_LOG = join(ROOT, 'logs', 'turbopack.log')
const DIAG_DIR = join(ROOT, 'diagnostics')
const JSONL_PATH = join(DIAG_DIR, 'turbopack-issues.jsonl')
const MD_PATH = join(DIAG_DIR, 'turbopack-summary.md')

mkdirSync(DIAG_DIR, { recursive: true })

console.log('🔍 Diagnóstico Turbopack — FASE 2 (stub)')
console.log('')

if (!existsSync(TURBOPACK_LOG)) {
  console.log(`⚠️  No existe ${TURBOPACK_LOG}`)
  console.log('   Ejecuta `bun run dev:all` para empezar a capturar errores Turbopack.')
  console.log('')
  console.log('✅ 0 errores Turbopack.')
  writeFileSync(
    MD_PATH,
    `# Turbopack — sin log\n\nNo existe \`logs/turbopack.log\`. Ejecuta \`bun run dev:all\` para empezar a capturar.\n\n**Errores encontrados: 0**\n`,
  )
  process.exit(0)
}

const log = readFileSync(TURBOPACK_LOG, 'utf8')

// Parser simple: cada línea que contenga "error" o "Error" o "Failed" o un stack.
const lines = log.split('\n')
const issues = []
const patterns = [
  /(?:error|Error|ERROR|Failed|FAILED)[^\n]*/,
  /\s+at\s+\S+\s+\([^)]+:\d+:\d+\)/, // stack frames
]

let currentIssue = null
for (const line of lines) {
  if (/Failed to compile|Error:|Module not found|Type error|Syntax error/i.test(line)) {
    if (currentIssue) issues.push(currentIssue)
    currentIssue = {
      timestamp: new Date().toISOString(),
      type: line.match(/(Failed to compile|Error|Module not found|Type error|Syntax error)/i)?.[1] || 'unknown',
      message: line.trim(),
      file: null,
      line: null,
      column: null,
      stack: [],
    }
  } else if (currentIssue && /\s+at\s+/.test(line)) {
    const m = line.match(/\((.+):(\d+):(\d+)\)/)
    if (m) {
      currentIssue.stack.push(line.trim())
      if (!currentIssue.file) {
        currentIssue.file = m[1]
        currentIssue.line = parseInt(m[2])
        currentIssue.column = parseInt(m[3])
      }
    }
  }
}
if (currentIssue) issues.push(currentIssue)

// Escribir JSONL
let jsonlContent = ''
for (const issue of issues) {
  jsonlContent += JSON.stringify(issue) + '\n'
}
writeFileSync(JSONL_PATH, jsonlContent)

// Escribir MD
const md = [
  `# Turbopack — Resumen`,
  '',
  `**Fecha:** ${new Date().toISOString()}`,
  `**Errores encontrados:** ${issues.length}`,
  '',
  ...(issues.length === 0
    ? ['✅ 0 errores Turbopack capturados.']
    : [
        '## Errores',
        '',
        ...issues.map((i, idx) => [
          `### #${idx + 1} — ${i.type}`,
          `- **Timestamp:** ${i.timestamp}`,
          `- **Mensaje:** ${i.message}`,
          i.file ? `- **Archivo:** ${i.file}:${i.line}:${i.column}` : '',
          i.stack.length > 0 ? '- **Stack:**' : '',
          ...i.stack.map((s) => `  - ${s}`),
          '',
        ].filter(Boolean)),
      ]),
  '',
  `> STUB FASE 2 — implementación completa en FASE 4.`,
].join('\n')

writeFileSync(MD_PATH, md)

console.log(`📊 Errores capturados: ${issues.length}`)
console.log(`📄 JSONL: ${JSONL_PATH}`)
console.log(`📄 MD:    ${MD_PATH}`)
