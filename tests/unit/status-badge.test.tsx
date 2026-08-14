// tests/unit/status-badge.test.tsx
// v1.0.20-FRONTEND-03: Tests para src/components/ui/status-badge.tsx

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatusBadge } from '../../src/components/ui/status-badge'

describe('StatusBadge', () => {
  describe('kind=order', () => {
    it('renderiza label correcto para ENVIADO', () => {
      const { getByText } = render(<StatusBadge kind="order" value="ENVIADO" />)
      expect(getByText('Enviado')).toBeTruthy()
    })

    it('renderiza label correcto para CANCELADO', () => {
      const { getByText } = render(<StatusBadge kind="order" value="CANCELADO" />)
      expect(getByText('Cancelado')).toBeTruthy()
    })

    it('renderiza el valor crudo para status desconocido', () => {
      const { getByText } = render(<StatusBadge kind="order" value="UNKNOWN_STATUS" />)
      expect(getByText('UNKNOWN_STATUS')).toBeTruthy()
    })

    it('acepta labelOverride', () => {
      const { getByText } = render(
        <StatusBadge kind="order" value="ENVIADO" labelOverride="Custom label" />,
      )
      expect(getByText('Custom label')).toBeTruthy()
    })

    it('renderiza dot cuando showDot=true', () => {
      const { container } = render(
        <StatusBadge kind="order" value="ENVIADO" showDot />,
      )
      const dot = container.querySelector('span[aria-hidden="true"]')
      expect(dot).toBeTruthy()
      expect(dot?.className).toContain('bg-blue')
    })

    it('no renderiza dot cuando showDot=false (default)', () => {
      const { container } = render(<StatusBadge kind="order" value="ENVIADO" />)
      const dot = container.querySelector('span[aria-hidden="true"]')
      expect(dot).toBeFalsy()
    })
  })

  describe('kind=table', () => {
    it('renderiza label correcto para LIBRE', () => {
      const { getByText } = render(<StatusBadge kind="table" value="LIBRE" />)
      expect(getByText('Libre')).toBeTruthy()
    })

    it('renderiza label correcto para OCUPADA', () => {
      const { getByText } = render(<StatusBadge kind="table" value="OCUPADA" />)
      expect(getByText('Ocupada')).toBeTruthy()
    })
  })

  describe('kind=item', () => {
    it('renderiza label correcto para PENDIENTE', () => {
      const { getByText } = render(<StatusBadge kind="item" value="PENDIENTE" />)
      expect(getByText('Pendiente')).toBeTruthy()
    })

    it('renderiza label correcto para LISTO', () => {
      const { getByText } = render(<StatusBadge kind="item" value="LISTO" />)
      expect(getByText('Listo')).toBeTruthy()
    })
  })

  describe('kind=payment', () => {
    it('renderiza label correcto para PAGADO', () => {
      const { getByText } = render(<StatusBadge kind="payment" value="PAGADO" />)
      expect(getByText('Pagado')).toBeTruthy()
    })

    it('renderiza label correcto para PARCIAL', () => {
      const { getByText } = render(<StatusBadge kind="payment" value="PARCIAL" />)
      expect(getByText('Parcial')).toBeTruthy()
    })
  })

  describe('kind=user-active', () => {
    it('renderiza "Activo" cuando value=true', () => {
      const { getByText } = render(<StatusBadge kind="user-active" value={true} />)
      expect(getByText('Activo')).toBeTruthy()
    })

    it('renderiza "Inactivo" cuando value=false', () => {
      const { getByText } = render(<StatusBadge kind="user-active" value={false} />)
      expect(getByText('Inactivo')).toBeTruthy()
    })

    it('renderiza "Inactivo" cuando value es string vacío', () => {
      const { getByText } = render(<StatusBadge kind="user-active" value="" />)
      expect(getByText('Inactivo')).toBeTruthy()
    })
  })

  describe('sizes', () => {
    it('size="sm" aplica clases compactas', () => {
      const { container } = render(
        <StatusBadge kind="order" value="ENVIADO" size="sm" />,
      )
      const badge = container.querySelector('span')
      expect(badge?.className).toContain('text-[10px]')
      expect(badge?.className).toContain('px-1.5')
    })

    it('size="md" (default) aplica text-xs', () => {
      const { container } = render(<StatusBadge kind="order" value="ENVIADO" />)
      const badge = container.querySelector('span')
      expect(badge?.className).toContain('text-xs')
    })
  })

  describe('props passthrough', () => {
    it('acepta className adicional', () => {
      const { container } = render(
        <StatusBadge kind="order" value="ENVIADO" className="ml-2 my-custom" />,
      )
      const badge = container.querySelector('span')
      expect(badge?.className).toContain('ml-2')
      expect(badge?.className).toContain('my-custom')
    })

    it('acepta data-testid', () => {
      const { container } = render(
        <StatusBadge kind="order" value="ENVIADO" data-testid="order-status" />,
      )
      const badge = container.querySelector('[data-testid="order-status"]')
      expect(badge).toBeTruthy()
    })
  })
})
