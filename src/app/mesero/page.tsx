'use client'

// v1.1.0-rc1: /mesero ahora redirige a /mesero/salon (nuevo POS).
// La antigua pantalla de "lista de pedidos" queda en /mesero/pedidos
// como función secundaria/histórico.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MeseroRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/mesero/salon')
  }, [router])
  return null
}
