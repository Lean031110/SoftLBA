import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    // Reportar errores de TypeScript durante el build (FIX 9)
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
