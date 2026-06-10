/** Single source of truth for the backend origin — MSW handlers import this too. */
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8090'
const BASE = API_BASE

export interface SystemMessage {
  code: string
  message: string
  fieldName?: string
  exceptionTraceId?: string
}

export class ApiError extends Error {
  constructor(public messages: SystemMessage[], public status: number) {
    super(messages[0]?.message ?? messages[0]?.code ?? `API error ${status}`)
    this.name = 'ApiError'
  }
}

let token: string | null = null
export function setToken(t: string | null) { token = t }

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => [])) as SystemMessage[]
    throw new ApiError(Array.isArray(body) && body.length ? body : [{ code: 'INTERNAL_ERROR', message: `HTTP ${res.status}` }], res.status)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}
