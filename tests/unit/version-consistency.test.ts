// tests/unit/version-consistency.test.ts
// FASE 1: Asegura que la versión esté unificada en TODAS las fuentes.
// Previene el patrón histórico donde git tag avanzaba pero package.json,
// README, CHANGELOG, sw.js y manifest.json se quedaban atrás.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '..', '..')

function readJson(rel: string): any {
  const raw = readFileSync(resolve(ROOT, rel), 'utf8')
  return JSON.parse(raw)
}

function readText(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

describe('FASE 1 — Consistencia de versión (fuente única)', () => {
  const pkg = readJson('package.json')
  const realtimePkg = readJson('mini-services/realtime-service/package.json')
  const manifest = readJson('public/manifest.json')
  const sw = readText('public/sw.js')
  const readme = readText('README.md')
  const changelog = readText('CHANGELOG.md')

  it('package.json tiene versión semver válida', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(-rc\d+)?$/)
  })

  it('mini-services/realtime-service/package.json está alineado con la raíz', () => {
    expect(realtimePkg.version).toBe(pkg.version)
  })

  it('manifest.json contiene "version" alineado con package.json', () => {
    expect(manifest.version).toBe(pkg.version)
    expect(manifest.version_name).toBe(pkg.version)
  })

  it('public/sw.js SW_VERSION está alineado con package.json', () => {
    const match = sw.match(/SW_VERSION\s*=\s*"softlba-v([^"]+)"/)
    expect(match, 'SW_VERSION no encontrada con formato esperado').not.toBeNull()
    expect(match![1]).toBe(pkg.version)
  })

  it('README.md badge refleja la versión actual', () => {
    const badge = `versión-${pkg.version.replace(/-/g, '--')}`
    expect(readme).toContain(badge)
  })

  it('README.md tabla contiene la versión actual', () => {
    expect(readme).toContain(`| Versión | ${pkg.version} |`)
  })

  it('CHANGELOG.md tiene entrada para la versión actual', () => {
    const entry = `## [${pkg.version}]`
    expect(changelog).toContain(entry)
  })

  it('src/lib/app-version.ts no contiene versión hardcoded', () => {
    const appVersionSrc = readText('src/lib/app-version.ts')
    // No debe contener un literal "1.x.x-rcN" como string hardcoded.
    const hardcoded = appVersionSrc.match(/['"](\d+\.\d+\.\d+(-rc\d+)?|\d+\.\d+\.\d+)['"]/)
    expect(hardcoded, `Encontrado literal hardcoded "${hardcoded}" en app-version.ts — debe derivarse de process.env`).toBeNull()
  })

  it('/api/health devuelve la versión correcta (derivada, no hardcoded)', () => {
    const healthRoute = readText('src/app/api/health/route.ts')
    expect(healthRoute).toContain('APP_VERSION')
    // No debe contener un literal "1.x.x-rcN".
    const hardcoded = healthRoute.match(/version:\s*['"](\d+\.\d+\.\d+(-rc\d+)?)['"]/)
    expect(hardcoded, `Encontrado literal hardcoded "${hardcoded}" en health/route.ts`).toBeNull()
  })

  it('mini-services/realtime-service/index.ts /health deriva de package.json', () => {
    const rt = readText('mini-services/realtime-service/index.ts')
    expect(rt).toContain("import pkg from './package.json'")
    expect(rt).toContain('SERVICE_VERSION')
    // No debe contener un literal "1.x.x-rcN" como valor de version en /health.
    const hardcoded = rt.match(/version:\s*['"](\d+\.\d+\.\d+(-rc\d+)?)['"]/)
    expect(hardcoded, `Encontrado literal hardcoded "${hardcoded}" en realtime-service/index.ts`).toBeNull()
  })
})
