// tests/unit/app-version.test.ts
// v1.0.20-FRONTEND-01 (FE-002): Tests para src/lib/app-version.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { APP_NAME, APP_VERSION, appVersion, appVersionDisplay, appFullName } from '../../src/lib/app-version'

describe('app-version module', () => {
  const originalVersion = process.env.NEXT_PUBLIC_APP_VERSION
  const originalName = process.env.NEXT_PUBLIC_APP_NAME

  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.NEXT_PUBLIC_APP_VERSION
    delete process.env.NEXT_PUBLIC_APP_NAME
  })

  afterEach(() => {
    // Restore original values
    if (originalVersion !== undefined) process.env.NEXT_PUBLIC_APP_VERSION = originalVersion
    if (originalName !== undefined) process.env.NEXT_PUBLIC_APP_NAME = originalName
  })

  it('expone APP_VERSION que proviene de process.env.NEXT_PUBLIC_APP_VERSION', () => {
    // Las constantes se evalúan en import time, así que solo verificamos
    // que sean strings no vacíos (ya leyeron el env al cargar el módulo).
    expect(typeof APP_VERSION).toBe('string')
    expect(APP_VERSION.length).toBeGreaterThan(0)
  })

  it('expone APP_NAME que proviene de process.env.NEXT_PUBLIC_APP_NAME', () => {
    expect(typeof APP_NAME).toBe('string')
    expect(APP_NAME.length).toBeGreaterThan(0)
  })

  it('appVersion es un alias de APP_VERSION', () => {
    expect(appVersion).toBe(APP_VERSION)
  })

  it('appVersionDisplay añade prefijo v si no lo tiene', () => {
    // Si APP_VERSION no empieza con 'v', appVersionDisplay añade 'v'.
    // Nota: esta verificación depende del valor real al cargar el módulo.
    // Si APP_VERSION = '1.0.20-rc14', appVersionDisplay = 'v1.0.20-rc14'.
    // Si APP_VERSION = 'dev', appVersionDisplay = 'dev' (caso sin env var).
    if (APP_VERSION === 'dev') {
      expect(appVersionDisplay).toBe('dev')
    } else if (APP_VERSION.startsWith('v')) {
      expect(appVersionDisplay).toBe(APP_VERSION)
    } else {
      expect(appVersionDisplay).toBe(`v${APP_VERSION}`)
    }
  })

  it('appVersionDisplay no duplica el prefijo v si ya lo tiene', () => {
    // Si la versión ya empieza con 'v', no se añade otro.
    // Esto se prueba indirectamente: appVersionDisplay debe empezar con 'v'
    // o ser 'dev', pero nunca 'vv...'.
    expect(appVersionDisplay.startsWith('vv')).toBe(false)
  })

  it('appFullName combina nombre + versión', () => {
    expect(appFullName).toContain(APP_NAME)
    expect(appFullName).toContain(appVersionDisplay)
  })
})

describe('app-version: fuente única de verdad', () => {
  it('NO contiene versiones hardcodeadas en código fuente', () => {
    // Este test es estructural — verifica que app-version.ts no tenga
    // strings de versión hardcodeados (debe leer del env).
    const source = readFileSync(
      resolve(__dirname, '../../src/lib/app-version.ts'),
      'utf8',
    )
    // Eliminar comentarios antes de buscar strings hardcoded.
    const withoutComments = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    // No debe contener strings literales como 'v0.6.0', 'v1.0.20-rc13', etc.
    // (la versión debe venir de process.env.NEXT_PUBLIC_APP_VERSION).
    expect(withoutComments).not.toMatch(/['"`]v\d+\.\d+\.\d+/)
    // Debe leer de process.env
    expect(withoutComments).toMatch(/process\.env\.NEXT_PUBLIC_APP_VERSION/)
  })
})
