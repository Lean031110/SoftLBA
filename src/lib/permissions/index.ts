// ============================================================
// Permisos por rol - Sistema de Restaurante Cuba
// ============================================================

export type UserRole = 'ADMIN' | 'MESERO' | 'COCINA' | 'PIZZERIA' | 'CAJERO'

// Páginas a las que cada rol puede acceder
export const ROLE_ROUTES: Record<UserRole, string[]> = {
  ADMIN: [
    '/admin',
    '/admin/usuarios',
    '/admin/productos',
    '/admin/recetas',
    '/admin/inventario',
    '/admin/inventario-general',
    '/admin/noticias',
    '/admin/clientes',
    '/admin/promociones',
    '/admin/finanzas',
    '/admin/cierre-diario',
    '/admin/configuracion',
    '/admin/auditoria',
    '/admin/respaldos',
    '/admin/ayuda',
    '/mesero',
    '/cocina',
    '/pizzeria',
  ],
  MESERO: ['/mesero', '/mesero/nuevo-pedido', '/mesero/pedidos', '/ayuda'],
  COCINA: ['/cocina', '/ayuda'],
  PIZZERIA: ['/pizzeria', '/ayuda'],
  CAJERO: ['/admin/finanzas', '/admin/cierre-diario', '/admin/pagos', '/ayuda'],
}

// Páginas destino tras login según rol
export const ROLE_HOME: Record<UserRole, string> = {
  ADMIN: '/admin',
  MESERO: '/mesero',
  COCINA: '/cocina',
  PIZZERIA: '/pizzeria',
  CAJERO: '/admin/cierre-diario',
}

// Verifica si un rol puede acceder a una ruta
export function canAccess(role: UserRole, path: string): boolean {
  const allowed = ROLE_ROUTES[role] || []
  // Permitir rutas públicas y de auth
  if (path === '/' || path.startsWith('/login') || path.startsWith('/logout') || path.startsWith('/api/auth')) {
    return true
  }
  // Permitir si la ruta está en la lista o es subruta de una permitida
  return allowed.some((allowedPath) => path === allowedPath || path.startsWith(allowedPath + '/'))
}

// Acciones permitidas por rol
export const PERMISSIONS = {
  // Mesero
  CAN_CREATE_ORDER: ['ADMIN', 'MESERO'],
  CAN_VIEW_OWN_ORDERS: ['ADMIN', 'MESERO'],
  CAN_VIEW_ALL_ORDERS: ['ADMIN'],
  CAN_COBRAR: ['ADMIN', 'CAJERO', 'MESERO'],
  // Cocina
  CAN_UPDATE_ORDER_STATUS: ['ADMIN', 'COCINA', 'PIZZERIA'],
  CAN_VIEW_KITCHEN: ['ADMIN', 'COCINA', 'PIZZERIA'],
  // Inventario
  CAN_MANAGE_GENERAL_INVENTORY: ['ADMIN'],
  CAN_MANAGE_AREA_INVENTORY: ['ADMIN', 'COCINA', 'PIZZERIA'],
  CAN_DO_PHYSICAL_STOCK: ['ADMIN', 'COCINA', 'PIZZERIA'],
  // Finanzas
  CAN_MANAGE_FINANCE: ['ADMIN', 'CAJERO'],
  CAN_DAILY_CLOSE: ['ADMIN', 'CAJERO'],
  // Admin
  CAN_MANAGE_USERS: ['ADMIN'],
  CAN_MANAGE_PRODUCTS: ['ADMIN'],
  CAN_MANAGE_CONFIG: ['ADMIN'],
  CAN_VIEW_AUDIT: ['ADMIN'],
  CAN_MANAGE_BACKUP: ['ADMIN'],
  CAN_MANAGE_NEWS: ['ADMIN'],
} as const

export function hasPermission(role: UserRole, permission: keyof typeof PERMISSIONS): boolean {
  const allowed = PERMISSIONS[permission]
  return (allowed as readonly string[]).includes(role)
}

// Etiquetas legibles para roles
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  MESERO: 'Mesero',
  COCINA: 'Cocina',
  PIZZERIA: 'Pizzería',
  CAJERO: 'Cajero',
}

// Colores de badge para roles
export const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  MESERO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  COCINA: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  PIZZERIA: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  CAJERO: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}
