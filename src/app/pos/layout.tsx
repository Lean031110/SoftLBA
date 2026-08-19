// src/app/pos/layout.tsx
// FASE 3 — Layout del nuevo POS de Salón.
// Reutiliza PanelLayout (que maneja auth, sidebar, header, realtime).
// Solo accesible para MESERO, MESERO_PRO y ADMIN.

import { PanelLayout } from '@/components/layout/panel-layout'

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <PanelLayout>{children}</PanelLayout>
}
