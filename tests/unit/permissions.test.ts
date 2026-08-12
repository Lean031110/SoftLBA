import { describe, it, expect } from 'vitest'
import { PERMISSIONS, ROLE_PERMISSIONS, hasPerm, requirePerm } from '../../src/lib/permissions/permissions-v2'
import type { UserRole } from '../../src/lib/permissions'

describe('Permissions v2', () => {
  describe('ROLE_PERMISSIONS', () => {
    it('ADMIN tiene todos los permisos', () => {
      const allPerms = Object.values(PERMISSIONS)
      expect(ROLE_PERMISSIONS.ADMIN.length).toBe(allPerms.length)
      allPerms.forEach((perm) => {
        expect(ROLE_PERMISSIONS.ADMIN).toContain(perm)
      })
    })

    it('MESERO tiene permisos limitados', () => {
      expect(ROLE_PERMISSIONS.MESERO).toContain(PERMISSIONS.ORDER_CREATE)
      expect(ROLE_PERMISSIONS.MESERO).toContain(PERMISSIONS.ORDER_PAY)
      expect(ROLE_PERMISSIONS.MESERO).not.toContain(PERMISSIONS.FINANCE_VIEW)
      expect(ROLE_PERMISSIONS.MESERO).not.toContain(PERMISSIONS.USER_MANAGE)
    })

    it('MESERO_PRO puede hacer cierres', () => {
      expect(ROLE_PERMISSIONS.MESERO_PRO).toContain(PERMISSIONS.DAILY_CLOSE)
      expect(ROLE_PERMISSIONS.MESERO).not.toContain(PERMISSIONS.DAILY_CLOSE)
    })

    it('CAJERO no puede gestionar usuarios', () => {
      expect(ROLE_PERMISSIONS.CAJERO).not.toContain(PERMISSIONS.USER_MANAGE)
      expect(ROLE_PERMISSIONS.CAJERO).toContain(PERMISSIONS.ORDER_PAY)
    })

    it('COCINA solo puede ver inventario', () => {
      expect(ROLE_PERMISSIONS.COCINA).toContain(PERMISSIONS.INVENTORY_VIEW)
      expect(ROLE_PERMISSIONS.COCINA.length).toBe(1)
    })
  })

  describe('hasPerm', () => {
    it('ADMIN tiene cualquier permiso', () => {
      expect(hasPerm('ADMIN', PERMISSIONS.ORDER_CREATE)).toBe(true)
      expect(hasPerm('ADMIN', PERMISSIONS.BACKUP_RESTORE)).toBe(true)
      expect(hasPerm('ADMIN', PERMISSIONS.USER_MANAGE)).toBe(true)
    })

    it('MESERO puede crear pedidos pero no gestionar finanzas', () => {
      expect(hasPerm('MESERO', PERMISSIONS.ORDER_CREATE)).toBe(true)
      expect(hasPerm('MESERO', PERMISSIONS.FINANCE_VIEW)).toBe(false)
    })

    it('permiso inexistente retorna false', () => {
      expect(hasPerm('MESERO', 'NONEXISTENT_PERMISSION')).toBe(false)
    })
  })

  describe('requirePerm', () => {
    it('no lanza si el rol tiene el permiso', () => {
      expect(() => requirePerm('ADMIN', PERMISSIONS.ORDER_CREATE)).not.toThrow()
    })

    it('lanza error si el rol no tiene el permiso', () => {
      expect(() => requirePerm('MESERO', PERMISSIONS.FINANCE_VIEW)).toThrow()
    })
  })
})
