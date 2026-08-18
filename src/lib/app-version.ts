// src/lib/app-version.ts
// Fuente única de versión para el frontend.
//
// Problema que resuelve (histórico):
// - El frontend tenía varios strings de versión distintos → operador no podía
//   saber qué versión estaba corriendo + causaba hydration mismatch.
// - El plan exige: "Crear una única fuente de verdad de versión".
//
// Solución:
// - `package.json` es la única fuente de versión.
// - `next.config.ts` la expone vía `process.env.NEXT_PUBLIC_APP_VERSION`.
// - Este módulo la expone de forma tipada para todo el frontend.
// - El SW la recibe vía el script de build (ver `public/sw.js` header).
//
// NOTA: El Service Worker NO puede importar este módulo (corre en contexto
// distinto). El SW usa una constante `SW_VERSION` que se bump manualmente
// en cada release (ver `public/sw.js`). FASE 1: validada por
// `tests/unit/version-consistency.test.ts` para evitar desincronización.
//
// Uso:
//   import { appVersion, appVersionDisplay } from '@/lib/app-version'
//   <span>{appVersionDisplay}</span>

export const APP_NAME: string = process.env.NEXT_PUBLIC_APP_NAME || 'softlba'

export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION || 'dev'

// Versión lista para mostrar (sin el prefijo 'v' para que el llamador lo añada
// si quiere: `v{appVersionDisplay}` o solo `{appVersionDisplay}`).
export const appVersion: string = APP_VERSION

// Display con prefijo 'v' si no lo tiene ya.
// '<semver>' → 'v<semver>'
// 'v<semver>' → 'v<semver>'
// 'dev' → 'dev' (placeholder, sin prefijo)
export const appVersionDisplay: string =
  APP_VERSION === 'dev' || APP_VERSION.startsWith('v')
    ? APP_VERSION
    : `v${APP_VERSION}`

// String completo para logs y diálogos "About":
//   "softlba v<semver>"
export const appFullName: string = `${APP_NAME} ${appVersionDisplay}`
