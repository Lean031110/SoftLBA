// tests/unit/install-backup-audit.test.ts
// FASE 32-33: Tests de instalación limpia y backup/restore
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8')
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), relPath))
}

// ============================================================
// FASE 32: INSTALACIÓN LIMPIA
// ============================================================
describe('FASE 32 — Instalación limpia desde cero', () => {
  it('package.json existe con scripts necesarios', () => {
    const content = readFile('package.json')
    expect(content).toContain('"dev"')
    expect(content).toContain('"build"')
    expect(content).toContain('"start"')
    expect(content).toContain('"db:generate"')
    expect(content).toContain('"db:push"')
    expect(content).toContain('"db:seed"')
    expect(content).toContain('"lint"')
  })

  it('.env.example existe con todas las variables críticas', () => {
    const content = readFile('.env.example')
    expect(content).toContain('DATABASE_URL')
    expect(content).toContain('NEXTAUTH_SECRET')
    expect(content).toContain('REALTIME_SECRET')
    expect(content).toContain('DEMO_USERS')
    expect(content).toContain('COOKIE_SECURE')
    expect(content).toContain('ALLOWED_ORIGINS')
  })

  it('.env NO está tracked en git', () => {
    const gitignore = readFile('.gitignore')
    expect(gitignore).toContain('.env')
    expect(gitignore).toContain('!.env.example')
  })

  it('prisma/schema.prisma existe', () => {
    expect(exists('prisma/schema.prisma')).toBe(true)
  })

  it('scripts/seed.ts existe', () => {
    expect(exists('scripts/seed.ts')).toBe(true)
  })

  it('README.md existe con instrucciones de instalación', () => {
    const content = readFile('README.md')
    expect(content).toContain('Instalación')
    expect(content).toContain('bun install')
    expect(content).toContain('.env.example')
    expect(content).toContain('db:push')
  })

  it('Caddyfile existe para proxy LAN', () => {
    expect(exists('Caddyfile')).toBe(true)
  })

  it('tsconfig.json existe', () => {
    expect(exists('tsconfig.json')).toBe(true)
  })

  it('vitest.config.ts existe', () => {
    expect(exists('vitest.config.ts')).toBe(true)
  })

  it('mini-services/realtime-service tiene package.json propio', () => {
    expect(exists('mini-services/realtime-service/package.json')).toBe(true)
    const content = readFile('mini-services/realtime-service/package.json')
    expect(content).toContain('"socket.io"')
  })

  it('mini-services/realtime-service tiene tsconfig.json propio', () => {
    expect(exists('mini-services/realtime-service/tsconfig.json')).toBe(true)
  })

  it('deploy/ tiene systemd services para producción', () => {
    expect(exists('deploy/softlba.service')).toBe(true)
    expect(exists('deploy/softlba-realtime.service')).toBe(true)
  })

  it('no hay rutas absolutas hardcodeadas en código runtime', () => {
    // Buscar /home/z/ o /opt/ hardcodeados en src/
    const srcDir = path.join(process.cwd(), 'src')
    function checkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          checkDir(fullPath)
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf-8')
          // Permitir en comentarios, pero no en código real
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (line.includes('/home/z/') && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
              throw new Error(`Ruta absoluta en ${fullPath}:${i + 1}: ${line.trim()}`)
            }
          }
        }
      }
    }
    expect(() => checkDir(srcDir)).not.toThrow()
  })
})

// ============================================================
// FASE 33: BACKUP Y RESTAURACIÓN
// ============================================================
describe('FASE 33 — Backup y restauración', () => {
  it('scripts/backup.ts existe', () => {
    expect(exists('scripts/backup.ts')).toBe(true)
  })

  it('endpoint POST /api/admin/respaldos existe', () => {
    expect(exists('src/app/api/admin/respaldos/route.ts')).toBe(true)
  })

  it('endpoint POST /api/admin/respaldos/restore existe', () => {
    expect(exists('src/app/api/admin/respaldos/restore/route.ts')).toBe(true)
  })

  it('endpoint GET /api/admin/respaldos/[id]/download existe', () => {
    expect(exists('src/app/api/admin/respaldos/[id]/download/route.ts')).toBe(true)
  })

  it('Backup model tiene checksum en schema', () => {
    const schema = readFile('prisma/schema.prisma')
    expect(schema).toContain('model Backup')
    expect(schema).toContain('checksum')
  })

  it('Backup model tiene checksum en schema', () => {
    const schema = readFile('prisma/schema.prisma')
    expect(schema).toContain('checksum')
  })

  it('scripts/backup.ts existe', () => {
    expect(exists('scripts/backup.ts')).toBe(true)
  })

  it('.gitignore excluye backups/', () => {
    const gitignore = readFile('.gitignore')
    expect(gitignore).toContain('backups')
  })

  it('.gitignore excluye .env (no se incluye en backup de código)', () => {
    const gitignore = readFile('.gitignore')
    expect(gitignore).toContain('.env')
  })
})
