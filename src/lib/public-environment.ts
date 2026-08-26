import { z } from 'zod'

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_BACKEND_URL: z.string().url().optional(),
  NEXT_PUBLIC_REALTIME_URL: z.string().url().optional(),
  NEXT_PUBLIC_REALTIME_PATH: z.string().regex(/^\//).optional(),
})

export function getPublicRealtimeConfig() {
  const config = publicEnvironmentSchema.parse({
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_REALTIME_URL: process.env.NEXT_PUBLIC_REALTIME_URL,
    NEXT_PUBLIC_REALTIME_PATH: process.env.NEXT_PUBLIC_REALTIME_PATH,
  })

  return {
    // Same-origin is the safe default behind the explicit Caddy /socket.io route.
    url: config.NEXT_PUBLIC_REALTIME_URL || config.NEXT_PUBLIC_BACKEND_URL || undefined,
    path: config.NEXT_PUBLIC_REALTIME_PATH || '/socket.io',
  }
}
