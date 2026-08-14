// src/app/loading.tsx
// v1.0.20-rc-final: Loading global para la ruta raíz.
import { LoadingScreen } from "@/components/loading"

export default function RootLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingScreen />
    </div>
  )
}
