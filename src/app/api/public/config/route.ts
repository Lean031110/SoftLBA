// GET /api/public/config - Configuración pública del restaurante
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const config = await db.restaurantConfig.findFirst()
  return NextResponse.json({
    ok: true,
    config: config
      ? {
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
          showDemoUsers: config.showDemoUsers,
          usdToCup: config.usdToCup,
          lastRateUpdate: config.lastRateUpdate,
          offlineTitle: config.offlineTitle,
          offlineMessage: config.offlineMessage,
          offlineWifiName: config.offlineWifiName,
          offlineInstructions: config.offlineInstructions,
        }
      : {
          // Configuración por defecto si no existe
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
          showDemoUsers: true,
        },
  })
}
