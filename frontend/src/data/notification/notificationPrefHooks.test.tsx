import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNotificationPrefs } from '@/data/notification/notificationPrefHooks'
import { notificationPrefSeed } from '@/data/notification/notificationMock'
import { isMockMode } from '@/data/_client/mode'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('useNotificationPrefs', () => {
  it('returns all 14 categories with the spec defaults (10 ON, gym leads 30)', async () => {
    // Registered unconditionally: harmless in mock mode (never reached), the read source of
    // truth in real mode (no default handler exists for this endpoint yet).
    server.use(http.get(`${API_BASE}/api/notification/pref`, () => HttpResponse.json({ prefs: notificationPrefSeed })))
    const { result } = renderHook(() => useNotificationPrefs(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.prefs).toHaveLength(14))
    expect(result.current.prefs).toEqual(notificationPrefSeed)
    const enabledCount = result.current.prefs.filter((p) => p.enabled).length
    expect(enabledCount).toBe(10)
    expect(result.current.prefs.find((p) => p.category === 'gym')?.leadMinutes).toBe(30)
  })

  it('mock mode never reaches the network for a read', async () => {
    if (!isMockMode()) return
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useNotificationPrefs(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.prefs).toHaveLength(14))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('mock mode never reaches the network for a write — setPref updates the cache only', async () => {
    if (!isMockMode()) return
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useNotificationPrefs(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.prefs).toHaveLength(14))

    await act(async () => { await result.current.setPref('midday', { enabled: true }) })

    await waitFor(() => expect(result.current.prefs.find((p) => p.category === 'midday')?.enabled).toBe(true))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('real mode: setPref optimistically flips the row, then PUTs just that one category', async () => {
    if (isMockMode()) return
    // A STATEFUL fake backend: onSettled invalidates and refetches, so a stateless GET
    // (always the pristine seed) would silently revert the optimistic flip the instant the
    // write resolves — this mirrors the real backend's per-category upsert instead.
    let state = notificationPrefSeed.map((p) => ({ ...p }))
    let captured: unknown
    server.use(
      http.get(`${API_BASE}/api/notification/pref`, () => HttpResponse.json({ prefs: state })),
      http.put(`${API_BASE}/api/notification/pref`, async ({ request }) => {
        const body = (await request.json()) as { prefs: typeof state }
        captured = body
        state = state.map((p) => body.prefs.find((x) => x.category === p.category) ?? p)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(() => useNotificationPrefs(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.prefs).toHaveLength(14))

    const before = result.current.prefs.find((p) => p.category === 'gym')
    expect(before?.enabled).toBe(true)

    let settled: Promise<void>
    act(() => { settled = result.current.setPref('gym', { enabled: false }) })
    // Optimistic: the row flips before the network call resolves, and stays flipped after the
    // post-settle invalidate/refetch reconciles with the (now-updated) fake server.
    await waitFor(() => expect(result.current.prefs.find((p) => p.category === 'gym')?.enabled).toBe(false))
    await act(async () => { await settled })
    await waitFor(() => expect(result.current.prefs.find((p) => p.category === 'gym')?.enabled).toBe(false))

    expect(captured).toEqual({ prefs: [{ category: 'gym', enabled: false, leadMinutes: 30 }] })
  })

  it('real mode: a failed write rolls the optimistic row back', async () => {
    if (isMockMode()) return
    server.use(
      http.get(`${API_BASE}/api/notification/pref`, () => HttpResponse.json({ prefs: notificationPrefSeed })),
      http.put(`${API_BASE}/api/notification/pref`, () => new HttpResponse(null, { status: 500 })),
    )
    const { result } = renderHook(() => useNotificationPrefs(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.prefs).toHaveLength(14))

    await act(async () => {
      await result.current.setPref('midday', { enabled: true }).catch(() => {})
    })

    // Rolled back to the pre-write value (midday defaults OFF) rather than staying stuck "on".
    await waitFor(() =>
      expect(result.current.prefs.find((p) => p.category === 'midday')?.enabled).toBe(false))
  })
})
