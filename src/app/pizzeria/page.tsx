'use client'

import { KitchenDashboard } from '@/components/kitchen/kitchen-dashboard'

export default function PizzeriaPage() {
  return <KitchenDashboard apiBase="/api/pizzeria" areaName="Pizzería" />
}
