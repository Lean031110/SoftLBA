// src/app/mesero/nuevo-pedido/page.tsx
// FASE 4 — Redirección al nuevo POS en /pos.
// El POS legacy se elimina y redirige.

import { redirect } from 'next/navigation'

export default function NuevoPedidoRedirect() {
  redirect('/pos')
}
