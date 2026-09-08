import { API_BASE } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { tokenStore } from '@/data/_client/tokenStore'

// Screen-event telemetry client (bd mezo-o5cz, spec 2026-09-07 §6).
//
// Fire-and-forget by design: events are buffered in memory, flushed on an interval and on
// `visibilitychange -> hidden` (with `keepalive` so a flush survives the page going away), and
// EVERY failure is swallowed. A 404 (the backend switch is off — the shipped default), a 429
// (rate limited), an expired token, an offline device: none of them may surface to the user or
// reach the app's error handling. Losing events is acceptable; degrading the app is not.
//
// Deliberately NOT built on `apiFetch`: that helper parses error bodies, throws `ApiError`, and —
// the disqualifying part — routes 401s into `handleAuthFailure`, which clears the token and signs
// the user out. A background telemetry POST must never be able to end a session.

/** Flush cadence. Small enough that a normal session ships its events, large enough to batch. */
export const TELEMETRY_FLUSH_MS = 15_000

/**
 * Local safety cap on the buffer, well under the server's `mezo.telemetry.batch-max` (50).
 * Reaching it means flushes are failing; dropping the OLDEST event keeps the buffer bounded and
 * keeps the most recent (most interesting) views.
 */
const MAX_BUFFERED = 40

const INGEST_PATH = '/api/telemetry/screen-events'

interface BufferedEvent {
  screen: string
  occurredAt: string
}

let buffer: BufferedEvent[] = []
let timer: ReturnType<typeof setInterval> | null = null
let listening = false

/**
 * Buffers one screen view. No-op in mock mode — the mock surface has no backend to write to, and
 * a demo session must never behave differently because of telemetry (spec T6).
 */
export function trackScreenView(screen: string): void {
  if (isMockMode()) return
  if (!screen) return
  buffer.push({ screen, occurredAt: new Date().toISOString() })
  if (buffer.length > MAX_BUFFERED) buffer = buffer.slice(-MAX_BUFFERED)
  ensureStarted()
}

/** Ships whatever is buffered. Safe to call at any time; a no-op when the buffer is empty. */
export function flushScreenEvents(keepalive = false): void {
  if (isMockMode()) return
  if (buffer.length === 0) return
  const events = buffer
  buffer = []
  const token = tokenStore.get()
  // No session, nothing to attribute the events to — drop them rather than posting a guaranteed
  // 401. (They are already out of the buffer: a signed-out window's views are not worth keeping.)
  if (!token) return
  try {
    void fetch(`${API_BASE}${INGEST_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events }),
      keepalive,
    }).catch(() => undefined)
  } catch {
    // `fetch` itself can throw synchronously (no network stack in some environments, a
    // keepalive body over the browser's limit). Same rule: swallow.
  }
}

/** Starts the interval + visibility listener exactly once, lazily on the first tracked view. */
function ensureStarted(): void {
  if (timer === null && typeof setInterval === 'function') {
    timer = setInterval(() => flushScreenEvents(false), TELEMETRY_FLUSH_MS)
  }
  if (!listening && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    listening = true
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
}

function onVisibilityChange(): void {
  // Hidden is the last reliable moment before a tab is frozen or discarded — `keepalive` lets the
  // request outlive the document. `visibilitychange` (not `unload`) is the only event mobile
  // Safari reliably fires when the user switches apps.
  if (document.visibilityState === 'hidden') flushScreenEvents(true)
}

/** Test seam: stops the interval/listener and drops the buffer. Not used by the app. */
export function resetTelemetryClientForTest(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  if (listening && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    listening = false
  }
  buffer = []
}
