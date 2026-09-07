import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setToken } from '@/data/_client/api'
import {
  TELEMETRY_FLUSH_MS,
  flushScreenEvents,
  resetTelemetryClientForTest,
  trackScreenView,
} from '@/data/telemetry/telemetryClient'

// Buffer/flush behaviour of the screen-event client (bd mezo-o5cz, spec §7).

describe('telemetryClient', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    resetTelemetryClientForTest()
    fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    resetTelemetryClientForTest()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    setToken(null)
  })

  function realMode() {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    setToken('t')
  }

  it('buffers views and ships them as ONE batch on the interval', () => {
    realMode()
    trackScreenView('/nap')
    trackScreenView('/fuel')
    expect(fetchSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(TELEMETRY_FLUSH_MS)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/api/telemetry/screen-events')
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body.events.map((e: { screen: string }) => e.screen)).toEqual(['/nap', '/fuel'])
    // The payload carries no owner field at all — created_by comes from the JWT server-side.
    expect(body.events[0]).not.toHaveProperty('createdBy')
  })

  it('empties the buffer on flush, so an idle interval sends nothing', () => {
    realMode()
    trackScreenView('/nap')
    vi.advanceTimersByTime(TELEMETRY_FLUSH_MS)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(TELEMETRY_FLUSH_MS * 3)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('flushes with keepalive when the document becomes hidden', () => {
    realMode()
    trackScreenView('/nap')
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    document.dispatchEvent(new Event('visibilitychange'))

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect((fetchSpy.mock.calls[0][1] as RequestInit).keepalive).toBe(true)
  })

  it('swallows a rejected request — telemetry must never surface an error', async () => {
    realMode()
    fetchSpy.mockImplementation(() => Promise.reject(new Error('offline')))
    trackScreenView('/nap')

    expect(() => vi.advanceTimersByTime(TELEMETRY_FLUSH_MS)).not.toThrow()
    await expect(Promise.resolve()).resolves.toBeUndefined()
  })

  it('is a hard no-op in mock mode', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    setToken('t')

    trackScreenView('/nap')
    vi.advanceTimersByTime(TELEMETRY_FLUSH_MS * 2)
    flushScreenEvents(true)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends nothing when there is no session token', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    setToken(null)

    trackScreenView('/nap')
    vi.advanceTimersByTime(TELEMETRY_FLUSH_MS)

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
