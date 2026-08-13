// tests/unit/security-audit.test.ts
// FASE 29-30: Tests de seguridad y PWA
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8')
}

// ============================================================
// FASE 29: SEGURIDAD Y AUTORIZACIÓN
// ============================================================
describe('FASE 29 — Seguridad: endpoints protegidos', () => {
  it('login tiene rate limiting', () => {
    const content = readFile('src/app/api/auth/login/route.ts')
    expect(content).toContain('checkRateLimit')
    expect(content).toContain('recordFailedAttempt')
    expect(content).toContain('recordSuccessfulAttempt')
  })

  it('internal/emit requiere shared secret', () => {
    const content = readFile('src/app/api/internal/emit/route.ts')
    expect(content).toContain('hasValidSecret')
    expect(content).toContain('X-Internal-Secret')
    expect(content).toContain('isLocalRequest')
  })

  it('public/config NO expone datos operacionales', () => {
    const content = readFile('src/app/api/public/config/route.ts')
    // No debe exponer usdToCup, offlineWifiName, offlineInstructions
    expect(content).not.toContain('config.usdToCup')
    expect(content).not.toContain('config.offlineWifiName')
    expect(content).not.toContain('config.offlineInstructions')
    expect(content).not.toContain('config.printerIp')
    expect(content).not.toContain('config.taxRate')
  })

  it('public/config usa DEMO_USERS env var', () => {
    const content = readFile('src/app/api/public/config/route.ts')
    expect(content).toContain('DEMO_USERS')
    expect(content).toContain('isDemoUsersEnabled')
  })

  it('admin/config valida URLs (anti-XSS)', () => {
    const content = readFile('src/app/api/admin/config/route.ts')
    expect(content).toContain('validateUrls')
    expect(content).toContain('url-validator')
  })

  it('getCurrentUser verifica authVersion', () => {
    const content = readFile('src/lib/auth/index.ts')
    expect(content).toContain('authVersion')
    expect(content).toContain('session.authVersion')
    expect(content).toContain('user.authVersion')
  })

  it('mesero endpoints verifican ownership del pedido', () => {
    const files = [
      'src/app/api/mesero/orders/[id]/route.ts',
      'src/app/api/mesero/orders/[id]/pay/route.ts',
      'src/app/api/mesero/orders/[id]/cancel/route.ts',
      'src/app/api/mesero/orders/[id]/items/route.ts',
    ]
    for (const f of files) {
      const content = readFile(f)
      expect(content).toContain('order.userId')
    }
  })

  it('token usa formato 5-part con authVersion', () => {
    const content = readFile('src/lib/auth/token.ts')
    expect(content).toContain('parts.length !== 4 && parts.length !== 5')
    expect(content).toContain('authVersion')
  })

  it('bumpAuthVersion existe para invalidar sesiones', () => {
    const content = readFile('src/lib/auth/index.ts')
    expect(content).toContain('bumpAuthVersion')
  })

  it('realtime rechaza eventos de negocio del cliente', () => {
    const content = readFile('mini-services/realtime-service/index.ts')
    expect(content).toContain('CLIENT_FORBIDDEN_EVENTS')
    expect(content).toContain('forbidden')
  })

  it('realtime usa token 5-part con authVersion', () => {
    const content = readFile('mini-services/realtime-service/index.ts')
    expect(content).toContain('authVersion')
    expect(content).toContain('parts.length !== 4 && parts.length !== 5')
  })

  it('Payment tiene idempotencyKey @unique', () => {
    expect(prisma.payment.fields.idempotencyKey).toBeDefined()
  })
})

// ============================================================
// FASE 30: PWA Y LAN
// ============================================================
describe('FASE 30 — PWA y funcionamiento LAN', () => {
  it('manifest.json existe', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'public/manifest.json'))).toBe(true)
  })

  it('service worker existe', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'public/sw.js'))).toBe(true)
  })

  it('service worker registration existe', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/components/service-worker-register.tsx'))).toBe(true)
  })

  it('no hay CDNs externos en el código', () => {
    const srcFiles = fs.readdirSync(path.join(process.cwd(), 'src'), { recursive: true })
      .filter(f => f.toString().endsWith('.ts') || f.toString().endsWith('.tsx'))
    const cdnPattern = /cdn\.|unpkg|jsdelivr|googleapis/
    for (const f of srcFiles) {
      const content = readFile(`src/${f}`)
      if (cdnPattern.test(content)) {
        // Allow if it's just a comment
        const lines = content.split('\n').filter(l => cdnPattern.test(l))
        const codeLines = lines.filter(l => !l.trim().startsWith('//'))
        expect(codeLines.length).toBe(0)
      }
    }
  })

  it('next.config usa output standalone (para LAN)', () => {
    const content = readFile('next.config.ts')
    expect(content).toContain('standalone')
  })

  it('Caddyfile existe para proxy LAN', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'Caddyfile'))).toBe(true)
  })

  it('service worker tiene background sync para POST', () => {
    const content = readFile('public/sw.js')
    expect(content).toContain('sync')
    expect(content).toContain('POST')
  })

  it('offline page existe', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/app/offline/page.tsx'))).toBe(true)
  })

  it('Payment.idempotencyKey protege contra reintentos del SW', () => {
    expect(prisma.payment.fields.idempotencyKey).toBeDefined()
  })
})

// ============================================================
// FASE 31: DATABASE Y MIGRACIONES
// ============================================================
describe('FASE 31 — Database: schema válido', () => {
  it('schema.prisma existe', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'prisma/schema.prisma'))).toBe(true)
  })

  it('User tiene authVersion', () => {
    const schema = readFile('prisma/schema.prisma')
    expect(schema).toContain('authVersion')
    expect(schema).toMatch(/authVersion\s+Int\s+@default\(1\)/)
  })

  it('Order tiene shiftId', () => {
    const schema = readFile('prisma/schema.prisma')
    expect(schema).toContain('shiftId')
  })

  it('Table tiene currentOrderId @unique', () => {
    const schema = readFile('prisma/schema.prisma')
    expect(schema).toContain('currentOrderId')
    expect(schema).toMatch(/currentOrderId\s+String\?\s+@unique/)
  })

  it('Payment tiene exchangeRate, convertedAmount, baseCurrency, idempotencyKey', () => {
    const schema = readFile('prisma/schema.prisma')
    expect(schema).toContain('exchangeRate')
    expect(schema).toContain('convertedAmount')
    expect(schema).toContain('baseCurrency')
    expect(schema).toContain('idempotencyKey')
  })

  it('DESPACHADO existe en OrderItemStatus', () => {
    const schema = readFile('prisma/schema.prisma')
    expect(schema).toContain('DESPACHADO')
  })

  it('blockNegativeStock default true', () => {
    const schema = readFile('prisma/schema.prisma')
    expect(schema).toContain('blockNegativeStock Boolean  @default(true)')
  })

  it('Product tiene saleAreaId, productionAreaId, dispatchMode', () => {
    const schema = readFile('prisma/schema.prisma')
    expect(schema).toContain('saleAreaId')
    expect(schema).toContain('productionAreaId')
    expect(schema).toContain('dispatchMode')
  })

  it('WorkShift existe con relación a Order', () => {
    const schema = readFile('prisma/schema.prisma')
    expect(schema).toContain('model WorkShift')
    expect(schema).toContain('shift         WorkShift?')
  })

  it('FinanceEntry tiene exchangeRate, convertedAmount, baseCurrency', () => {
    const schema = readFile('prisma/schema.prisma')
    // Verificar que FinanceEntry tiene los campos
    const feSection = schema.substring(schema.indexOf('model FinanceEntry'))
    expect(feSection).toContain('exchangeRate')
    expect(feSection).toContain('convertedAmount')
    expect(feSection).toContain('baseCurrency')
  })

  it('.env.example existe con todas las variables', () => {
    const content = readFile('.env.example')
    expect(content).toContain('DATABASE_URL')
    expect(content).toContain('NEXTAUTH_SECRET')
    expect(content).toContain('REALTIME_SECRET')
    expect(content).toContain('DEMO_USERS')
    expect(content).toContain('COOKIE_SECURE')
  })

  it('.env NO está tracked en git', () => {
    // El .gitignore debe excluir .env
    const gitignore = readFile('.gitignore')
    expect(gitignore).toContain('.env')
    expect(gitignore).toContain('!.env.example')
  })
})
