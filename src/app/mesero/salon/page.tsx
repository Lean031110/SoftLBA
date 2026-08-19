// src/app/mesero/salon/page.tsx
// FASE 4 — Redirección al nuevo POS en /pos.
// El POS viejo se mantiene como redirect hasta que /pos sea validado en producción.
// Una vez validado, se puede eliminar esta ruta y /mesero/nuevo-pedido.

import { redirect } from 'next/navigation'

export default function SalonRedirect() {
  redirect('/pos')
}
