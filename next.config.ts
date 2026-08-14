import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

// v1.0.20-rc-final: exponer la versión de package.json al cliente vía
// process.env.NEXT_PUBLIC_APP_VERSION para que todas las páginas muestren
// la misma versión (ver docs/FRONTEND_AUDIT.md P0-6).
const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    // Reportar errores de TypeScript durante el build (FIX 9)
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_NAME: pkg.name,
  },
};

export default nextConfig;
