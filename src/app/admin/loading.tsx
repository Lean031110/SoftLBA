// src/app/admin/loading.tsx
// v1.0.20-rc-final: Loading UI para /admin/* — evita pantalla en blanco
// mientras la página carga sus datos.

import { LoadingScreen } from "@/components/loading"

export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingScreen />
    </div>
  )
}
