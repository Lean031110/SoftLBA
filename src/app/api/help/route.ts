// GET /api/help - Vista pública de artículos activos (para usuarios autenticados)
// FE-037 (FRONTEND-11): filtra artículos por rol del usuario.
// El plan sección 26 exige: "el backend debe ignorar un `area` no autorizado
// enviado por cliente y derivarlo del usuario autenticado."
//
// Mapeo de módulos → roles permitidos:
//   pedidos: MESERO, MESERO_PRO, ADMIN, CAJERO
//   cierre: ADMIN, CAJERO, MESERO_PRO
//   inventario: ADMIN, COCINA, PIZZERIA
//   productos: ADMIN
//   sistema: todos los roles
//
// Un COCINA no debe ver artículos de "pedidos" o "cierre" — solo los
// relevantes a su área (inventario + sistema).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// Módulos visibles por cada rol. Si un rol no está en la lista de un módulo,
// no verá los artículos de ese módulo.
const MODULES_BY_ROLE: Record<string, string[]> = {
  ADMIN: ['pedidos', 'cierre', 'inventario', 'productos', 'sistema'],
  CAJERO: ['pedidos', 'cierre', 'sistema'],
  MESERO: ['pedidos', 'sistema'],
  MESERO_PRO: ['pedidos', 'cierre', 'sistema'],
  COCINA: ['inventario', 'sistema'],
  PIZZERIA: ['inventario', 'sistema'],
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })

    // FE-037: filtrar módulos según el rol del usuario.
    const allowedModules = MODULES_BY_ROLE[user.role] || ['sistema']

    const items = await db.helpArticle.findMany({
      where: {
        isActive: true,
        module: { in: allowedModules },
      },
      orderBy: [{ module: 'asc' }, { order: 'asc' }, { title: 'asc' }],
      select: { id: true, module: true, title: true, content: true, order: true },
    })

    return NextResponse.json({ ok: true, items, role: user.role })
  } catch (e: any) {
    console.error('GET /api/help', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
