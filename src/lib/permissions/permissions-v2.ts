// ============================================================
// Permisos granular centralizado (FIX 14)
// ------------------------------------------------------------
// Sistema de permisos basado en strings (PERMISSIONS) y matriz
// rol → permisos (ROLE_PERMISSIONS). Reemplaza al sistema antiguo
// basado en `PERMISSIONS: Record<perm, UserRole[]>` que vivía en
// src/lib/permissions/index.ts (mantenido por compatibilidad).
//
// Uso:
//   import { hasPerm, requirePerm, PERMISSIONS } from '@/lib/permissions/permissions-v2'
//   if (hasPerm(user.role, PERMISSIONS.ORDER_CREATE)) { ... }
//   requirePerm(user.role, PERMISSIONS.DAILY_CLOSE) // lanza si no tiene
// ============================================================

import type { UserRole } from '@/lib/permissions'

// Conjunto canónico de permisos del sistema (string constants).
// Cualquier nuevo módulo debe añadir aquí su permiso y mapearlo
// en ROLE_PERMISSIONS.
export const PERMISSIONS = {
  ORDER_CREATE: 'ORDER_CREATE',
  ORDER_EDIT: 'ORDER_EDIT',
  ORDER_CANCEL: 'ORDER_CANCEL',
  ORDER_PAY: 'ORDER_PAY',
  ORDER_DISCOUNT: 'ORDER_DISCOUNT',
  INVENTORY_VIEW: 'INVENTORY_VIEW',
  INVENTORY_ADJUST: 'INVENTORY_ADJUST',
  FINANCE_VIEW: 'FINANCE_VIEW',
  FINANCE_EDIT: 'FINANCE_EDIT',
  DAILY_CLOSE: 'DAILY_CLOSE',
  DAILY_CLOSE_LOCK: 'DAILY_CLOSE_LOCK',
  BACKUP_CREATE: 'BACKUP_CREATE',
  BACKUP_RESTORE: 'BACKUP_RESTORE',
  USER_MANAGE: 'USER_MANAGE',
  PRODUCT_MANAGE: 'PRODUCT_MANAGE',
  CONFIG_MANAGE: 'CONFIG_MANAGE',
  AUDIT_VIEW: 'AUDIT_VIEW',
} as const

export type PermissionKey = keyof typeof PERMISSIONS
export type Permission = (typeof PERMISSIONS)[PermissionKey]

// Matriz rol → lista de permisos.
// ADMIN hereda todos los permisos automáticamente (Object.values(PERMISSIONS)),
// por lo que añadir un permiso nuevo a PERMISSIONS automáticamente lo otorga
// a ADMIN sin tocar esta matriz.
export const ROLE_PERMISSIONS: Record<UserRole, readonly string[]> = {
  ADMIN: Object.values(PERMISSIONS),
  MESERO: [
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_PAY,
  ],
  MESERO_PRO: [
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_PAY,
    PERMISSIONS.DAILY_CLOSE,
  ],
  COCINA: [PERMISSIONS.INVENTORY_VIEW],
  PIZZERIA: [PERMISSIONS.INVENTORY_VIEW],
  CAJERO: [
    PERMISSIONS.ORDER_PAY,
    PERMISSIONS.DAILY_CLOSE,
    PERMISSIONS.FINANCE_VIEW,
  ],
}

// Conjunto congelado para lookups O(1) por rol.
const ROLE_PERM_SET: Record<UserRole, Set<string>> = Object.fromEntries(
  (Object.keys(ROLE_PERMISSIONS) as UserRole[]).map((role) => [
    role,
    new Set(ROLE_PERMISSIONS[role]),
  ]),
) as Record<UserRole, Set<string>>

/**
 * Verifica si un rol tiene un permiso dado.
 *
 * @param role Rol del usuario autenticado.
 * @param perm Permiso a verificar (string, idealmente uno de PERMISSIONS.*).
 * @returns true si el rol tiene el permiso, false en caso contrario.
 */
export function hasPerm(role: UserRole, perm: string): boolean {
  const set = ROLE_PERM_SET[role]
  if (!set) return false
  return set.has(perm)
}

/**
 * Lanza un error si el rol no tiene el permiso dado.
 *
 * Útil en API routes para early-return con un 403 consistente:
 *
 *   try { requirePerm(user.role, PERMISSIONS.ORDER_PAY) }
 *   catch (e) { return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 }) }
 *
 * @throws Error('SIN_PERMISO') si el rol no tiene el permiso.
 */
export function requirePerm(role: UserRole, perm: string): void {
  if (!hasPerm(role, perm)) {
    const err = new Error('SIN_PERMISO') as Error & { code?: string; perm?: string }
    err.code = 'SIN_PERMISO'
    err.perm = perm
    throw err
  }
}

/**
 * Helper opcional: lista de permisos de un rol (copia defensiva).
 */
export function permsForRole(role: UserRole): string[] {
  return Array.from(ROLE_PERM_SET[role] ?? [])
}

/**
 * Etiquetas legibles para cada permiso (para UI / docs).
 */
export const PERMISSION_LABELS: Record<string, string> = {
  ORDER_CREATE: 'Crear pedidos',
  ORDER_EDIT: 'Editar pedidos',
  ORDER_CANCEL: 'Cancelar pedidos',
  ORDER_PAY: 'Cobrar pedidos',
  ORDER_DISCOUNT: 'Aplicar descuentos',
  INVENTORY_VIEW: 'Ver inventario',
  INVENTORY_ADJUST: 'Ajustar inventario',
  FINANCE_VIEW: 'Ver finanzas',
  FINANCE_EDIT: 'Editar finanzas',
  DAILY_CLOSE: 'Cerrar caja diaria',
  DAILY_CLOSE_LOCK: 'Bloquear cierre diario',
  BACKUP_CREATE: 'Crear respaldos',
  BACKUP_RESTORE: 'Restaurar respaldos',
  USER_MANAGE: 'Gestionar usuarios',
  PRODUCT_MANAGE: 'Gestionar productos',
  CONFIG_MANAGE: 'Gestionar configuración',
  AUDIT_VIEW: 'Ver auditoría',
}
