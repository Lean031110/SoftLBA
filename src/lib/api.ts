// src/lib/api.ts
// v1.0.20-rc-final: Wrapper centralizado para fetch en el cliente.
//
// Problema que resuelve:
// - 47 páginas usan fetch() directo. Sin manejo de 401, sin AbortController,
//   sin retry. Si la sesión expira (TTL 12h), el usuario ve errores genéricos
//   y debe navegar manualmente a /logout.
//
// Solución:
// - apiFetch() intercepta 401 y redirige a /login?expired=1
// - Soporta AbortController vía opts.signal
// - Lanza Error con data.error del backend (o mensaje genérico)
// - Llamadas tipadas: apiFetch<{ok:true, items:Product[]}>('/api/...')

'use client'

export class ApiError extends Error {
  status: number
  code?: string
  data?: any
  constructor(message: string, status: number, code?: string, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
  }
}

export async function apiFetch<T = any>(
  path: string,
  opts: RequestInit & { signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    ...opts,
  })

  // 401 → sesión expirada, redirigir a /login
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search
      const loginUrl = `/login?expired=1&redirect=${encodeURIComponent(currentPath)}`
      window.location.href = loginUrl
    }
    throw new ApiError('Sesión expirada', 401, 'SESION_EXPIRADA')
  }

  // 204 No Content
  if (res.status === 204) {
    return { ok: true } as T
  }

  // Parse JSON (siempre esperamos JSON de /api/*)
  let data: any
  try {
    data = await res.json()
  } catch {
    throw new ApiError('Respuesta inválida del servidor', res.status)
  }

  if (!res.ok || data.ok === false) {
    const message = data.error || data.message || `Error ${res.status}`
    throw new ApiError(message, res.status, data.code, data)
  }

  return data as T
}

// Helper para peticiones GET tipadas
export async function apiGet<T = any>(path: string, signal?: AbortSignal): Promise<T> {
  return apiFetch<T>(path, { method: 'GET', signal })
}

// Helper para peticiones POST tipadas
export async function apiPost<T = any>(path: string, body?: any, signal?: AbortSignal): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })
}

// Helper para peticiones PATCH tipadas
export async function apiPatch<T = any>(path: string, body?: any, signal?: AbortSignal): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })
}

// Helper para peticiones DELETE tipadas
export async function apiDelete<T = any>(path: string, signal?: AbortSignal): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE', signal })
}
