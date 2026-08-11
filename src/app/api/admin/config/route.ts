// GET /api/admin/config - Obtener configuración (singleton id='config-1')
// PATCH /api/admin/config - Actualizar configuración
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const CONFIG_ID = 'config-1'

async function getOrCreateConfig() {
  let config = await db.restaurantConfig.findFirst()
  if (!config) {
    config = await db.restaurantConfig.create({ data: { id: CONFIG_ID } })
  }
  return config
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const config = await getOrCreateConfig()
    return NextResponse.json({ ok: true, item: config })
  } catch (e: any) {
    console.error('GET /api/admin/config', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  legalName: z.string().max(200).optional().or(z.literal('')),
  logo: z.string().max(500).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  phone: z.string().max(60).optional().or(z.literal('')),
  email: z.string().max(120).optional().or(z.literal('')),
  website: z.string().max(200).optional().or(z.literal('')),
  facebook: z.string().max(200).optional().or(z.literal('')),
  instagram: z.string().max(200).optional().or(z.literal('')),
  telegram: z.string().max(200).optional().or(z.literal('')),
  whatsapp: z.string().max(60).optional().or(z.literal('')),
  hours: z.string().max(300).optional().or(z.literal('')),
  slogan: z.string().max(300).optional().or(z.literal('')),
  welcomeText: z.string().max(1000).optional().or(z.literal('')),
  currency: z.string().max(10).optional(),
  currencySymbol: z.string().max(5).optional(),
  receiptHeader: z.string().max(500).optional().or(z.literal('')),
  receiptFooter: z.string().max(500).optional().or(z.literal('')),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  showDemoUsers: z.boolean().optional(),
  // Impresora térmica
  printerEnabled: z.boolean().optional(),
  printerName: z.string().max(200).optional().or(z.literal('')),
  printerIp: z.string().max(100).optional().or(z.literal('')),
  printerPort: z.coerce.number().min(1).max(65535).optional(),
  printerWidth: z.coerce.number().min(58).max(80).optional(),
  printerAutoPrint: z.boolean().optional(),
  // Tasa de cambio
  usdToCup: z.coerce.number().min(0).optional(),
  rateReminderEnabled: z.boolean().optional(),
  // Página offline
  offlineTitle: z.string().max(200).optional(),
  offlineMessage: z.string().max(1000).optional(),
  offlineWifiName: z.string().max(200).optional().or(z.literal('')),
  offlineInstructions: z.string().max(2000).optional().or(z.literal('')),
})

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const before = await getOrCreateConfig()

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const nullable = ['legalName', 'logo', 'address', 'phone', 'email', 'website', 'facebook', 'instagram', 'telegram', 'whatsapp', 'hours', 'slogan', 'welcomeText', 'receiptHeader', 'receiptFooter', 'printerName', 'printerIp', 'offlineWifiName', 'offlineInstructions']
    const data: any = {}
    for (const [k, v] of Object.entries(d)) {
      if (v === undefined) continue
      if (v === '' && nullable.includes(k)) {
        data[k] = null
      } else {
        data[k] = v
      }
    }
    // Si se actualiza la tasa, registrar la fecha
    if (data.usdToCup !== undefined) {
      data.lastRateUpdate = new Date()
    }

    const updated = await db.restaurantConfig.update({ where: { id: CONFIG_ID }, data })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'config',
      entityId: CONFIG_ID,
      before: { name: before.name, slogan: before.slogan, currency: before.currency, taxRate: before.taxRate },
      after: { name: updated.name, slogan: updated.slogan, currency: updated.currency, taxRate: updated.taxRate },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/admin/config', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
