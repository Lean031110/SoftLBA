// tests/unit/empty-state.test.tsx
// v1.0.20-FRONTEND-03: Tests para src/components/ui/empty-state.tsx

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EmptyState } from '../../src/components/ui/empty-state'

describe('EmptyState', () => {
  it('renderiza el título', () => {
    const { getByText } = render(<EmptyState title="No hay usuarios" />)
    expect(getByText('No hay usuarios')).toBeTruthy()
  })

  it('renderiza la descripción si se pasa', () => {
    const { getByText } = render(
      <EmptyState title="No hay usuarios" description="Crea el primer usuario." />,
    )
    expect(getByText('Crea el primer usuario.')).toBeTruthy()
  })

  it('no renderiza descripción si no se pasa', () => {
    const { container } = render(<EmptyState title="No hay usuarios" />)
    const paragraphs = container.querySelectorAll('p')
    // Solo el título debe estar presente.
    expect(paragraphs.length).toBe(1)
  })

  it('renderiza icono si se pasa', () => {
    const { container } = render(
      <EmptyState title="No hay usuarios" icon={<svg data-testid="test-icon" />} />,
    )
    const icon = container.querySelector('[data-testid="test-icon"]')
    expect(icon).toBeTruthy()
  })

  it('no renderiza icono si no se pasa', () => {
    const { container } = render(<EmptyState title="No hay usuarios" />)
    const iconWrapper = container.querySelector('[aria-hidden="true"]')
    expect(iconWrapper).toBeFalsy()
  })

  it('renderiza acción si se pasa', () => {
    const { getByText } = render(
      <EmptyState title="No hay usuarios" action={<button>Crear usuario</button>} />,
    )
    expect(getByText('Crear usuario')).toBeTruthy()
  })

  it('compact aplica padding p-6 en vez de p-10', () => {
    const { container } = render(<EmptyState title="Test" compact />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('p-6')
    expect(wrapper.className).not.toContain('p-10')
  })

  it('default (no compact) aplica p-10', () => {
    const { container } = render(<EmptyState title="Test" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('p-10')
  })

  it('acepta className adicional', () => {
    const { container } = render(
      <EmptyState title="Test" className="my-custom-class" />,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('my-custom-class')
  })

  it('acepta props HTML nativos como role', () => {
    const { container } = render(<EmptyState title="Test" role="status" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBe('status')
  })
})
