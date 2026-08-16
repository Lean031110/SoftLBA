import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

// v1.0.20-rc-final: exponer la versión de package.json al cliente vía
// process.env.NEXT_PUBLIC_APP_VERSION para que todas las páginas muestren
// la misma versión (ver docs/FRONTEND_AUDIT.md P0-6).
//
// FE-042 (FRONTEND-15): optimizaciones de performance.
// - compress: true → respuesta HTTP comprimida con gzip/brotli.
// - poweredByHeader: false → no revelar tecnología del servidor.
// - images.formats: avif + webp → imágenes más ligeras.
const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // Reportar errores de TypeScript durante el build (FIX 9)
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // FE-042: comprimir respuestas HTTP (gzip/brotli automático).
  compress: true,
  // FE-042: no revelar tecnología del servidor en headers.
  poweredByHeader: false,
  // FE-042: optimización de imágenes con AVIF + WebP.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_NAME: pkg.name,
  },
};

export default nextConfig;
