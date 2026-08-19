// src/app/pizzeria/page.tsx
// FASE 6 — KDS de Pizzería (reconstruido).

'use client'

import { KDSDashboard } from '@/components/production/kds-dashboard'

export default function PizzeriaPage() {
  return <KDSDashboard apiBase="/api/pizzeria" areaName="Pizzería" accentColor="orange" />
}
