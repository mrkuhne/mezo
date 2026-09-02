import { tokenStore } from '@/data/_client/tokenStore'
import { authEvents } from '@/data/_client/authEvents'

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

/** Writes the persisted token store — kept as the historical name so callers/tests do not move. */
export function setToken(t: string | null) { tokenStore.set(t) }

/**
 * Public auth paths where a 401 means "wrong credentials", never "your session died".
 * change-password is PROTECTED (needs a valid bearer) but answers 401 when the CURRENT
 * password is wrong — without this exemption a mistyped current password would log the
 * user out instead of just failing the form.
 */
const PUBLIC_AUTH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/change-password']

/**
 * Session-death detection shared by apiFetch and apiSse: a 401 anywhere protected, or a 403
 * carrying AUTH_ACCOUNT_DISABLED, drops the token and tells AuthGate to show the login screen.
 * A 403 AUTH_FORBIDDEN (owner-only endpoint) is a permission problem, not a session one.
 */
function handleAuthFailure(path: string, status: number, messages: SystemMessage[]): void {
  if (PUBLIC_AUTH_PATHS.includes(path)) return
  if (status === 401) { tokenStore.clear(); authEvents.emitSignedOut('expired'); return }
  if (status === 403 && messages.some((m) => m.code === 'AUTH_ACCOUNT_DISABLED')) {
    tokenStore.clear(); authEvents.emitSignedOut('disabled')
  }
}

function authHeader(): Record<string, string> {
  const token = tokenStore.get()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // FormData bodies (multipart uploads) MUST NOT carry a manual Content-Type — the browser
  // sets it together with the multipart boundary. JSON callers are unchanged.
  const isForm = init.body instanceof FormData
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader(),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => [])) as SystemMessage[]
    const messages = Array.isArray(body) && body.length ? body : [{ code: 'INTERNAL_ERROR', message: `HTTP ${res.status}` }]
    handleAuthFailure(path, res.status, messages)
    throw new ApiError(messages, res.status)
  }
  if (res.status === 204) return undefined as T
  // Not every success carries a body: 202 Accepted (report regeneration) answers with none,
  // and `res.json()` on an empty body throws a SyntaxError. Read the text first and only
  // parse when there is something to parse — a no-content success resolves to `undefined`.
  const text = await res.text()
  return (text ? (JSON.parse(text) as T) : (undefined as T))
}

/**
 * SSE over fetch (POST-capable, Authorization-capable — EventSource is neither).
 * Yields `{ event, data }` per frame; every `data:` payload on this API is a single JSON
 * line by contract (the backend JSON-encodes deltas), multi-line data is still joined per
 * the SSE spec. Non-OK responses throw the same ApiError as apiFetch (the backend emits
 * pre-stream failures as regular SystemMessageList JSON).
 */
export async function* apiSse(
  path: string,
  init: RequestInit = {},
): AsyncGenerator<{ event: string; data: string }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
      ...authHeader(),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => [])) as SystemMessage[]
    const messages = Array.isArray(body) && body.length ? body : [{ code: 'INTERNAL_ERROR', message: `HTTP ${res.status}` }]
    handleAuthFailure(path, res.status, messages)
    throw new ApiError(messages, res.status)
  }
  if (!res.body) {
    throw new ApiError([{ code: 'STREAM_ERROR', message: 'No response body' }], res.status)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let sep: number
      while ((sep = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, sep)
        buf = buf.slice(sep + 2)
        const event = parseSseFrame(frame)
        if (event) yield event
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function parseSseFrame(frame: string): { event: string; data: string } | null {
  let event = 'message'
  const data: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trimStart()
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
    // id:/retry:/comment lines are ignored — this client doesn't resume streams
  }
  return data.length ? { event, data: data.join('\n') } : null
}
