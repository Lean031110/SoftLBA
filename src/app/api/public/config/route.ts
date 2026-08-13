// GET /api/public/config - Configuración pública del restaurante
// ------------------------------------------------------------
// v1.0.19.4 (FASE 29): NO expone datos operacionales.
// Solo datos públicos visibles para clientes anónimos.
// ============================================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// v1.0.19.4: DEMO_USERS controla si los usuarios demo son visibles.
function isDemoUsersEnabled(): boolean {
  const env = process.env.DEMO_USERS
  if (env === 'true') return true
  if (env === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

export async function GET() {
  const config = await db.restaurantConfig.findFirst()
  const demoUsersEnabled = isDemoUsersEnabled()

  return NextResponse.json({
    ok: true,
    config: config
      ? {
          // Solo datos públicos (NO operacionales)
          name: config.name,
          slogan: config.slogan,
          address: config.address,
          phone: config.phone,
          email: config.email,
          hours: config.hours,
          logo: config.logo,
          currency: config.currency,
          currencySymbol: config.currencySymbol,
          welcomeText: config.welcomeText,
          showDemoUsers: demoUsersEnabled,
        }
      : {
          name: 'Restaurante',
          slogan: null,
          address: null,
          phone: null,
          email: null,
          hours: null,
          logo: null,
          currency: 'CUP',
          currencySymbol: '$',
          welcomeText: null,
          showDemoUsers: demoUsersEnabled,
        },
  })
}
