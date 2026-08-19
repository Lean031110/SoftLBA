'use client'

import { KitchenDashboard } from '@/components/kitchen/kitchen-dashboard'

export default function CocinaPage() {
  return <KitchenDashboard apiBase="/api/cocina" areaName="Cocina" />
}
