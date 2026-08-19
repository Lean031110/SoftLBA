import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ============================================================
// FASE 3 (config centralizada): leer config.json si existe
// para exponer URLs públicas al browser (NEXT_PUBLIC_*).
// Las variables NEXT_PUBLIC_* también se pueden setear en .env.
// ============================================================

interface ConfigFile {
  client?: {
    publicBackendUrl?: string;
    publicRealtimeUrl?: string;
    publicPrintWorkerUrl?: string;
  };
}

function loadConfigJson(): ConfigFile {
  const configPath = process.env.CONFIG_PATH || join(process.cwd(), "config.json");
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as ConfigFile;
  } catch {
    return {};
  }
}

const configFile = loadConfigJson();

// Las variables NEXT_PUBLIC_* se resuelven así:
//   1. process.env (de .env) — prioridad alta
//   2. config.json (client.publicXxxUrl)
//   3. '' (default — el browser usará mismo origen o XTransformPort)
const publicBackendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || configFile.client?.publicBackendUrl || "";
const publicRealtimeUrl =
  process.env.NEXT_PUBLIC_REALTIME_URL || configFile.client?.publicRealtimeUrl || "";
const publicPrintWorkerUrl =
  process.env.NEXT_PUBLIC_PRINT_WORKER_URL || configFile.client?.publicPrintWorkerUrl || "";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // Reportar errores de TypeScript durante el build (FIX 9)
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_NAME: pkg.name,
    NEXT_PUBLIC_BACKEND_URL: publicBackendUrl,
    NEXT_PUBLIC_REALTIME_URL: publicRealtimeUrl,
    NEXT_PUBLIC_PRINT_WORKER_URL: publicPrintWorkerUrl,
  },
  // Permitir orígenes del preview (sandbox z.ai) para HMR/WebSocket de dev.
  // No afecta producción.
  allowedDevOrigins: [
    "*.space-z.ai",
    "*.chatglm.cn",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
