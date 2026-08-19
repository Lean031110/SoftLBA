// src/app/cocina/page.tsx
// FASE 6 — KDS de Cocina (reconstruido).

'use client'

import { KDSDashboard } from '@/components/production/kds-dashboard'

export default function CocinaPage() {
  return <KDSDashboard apiBase="/api/cocina" areaName="Cocina" accentColor="blue" />
}
