import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { useGamification } from '@/data/gamification/gamificationHooks'
import { API_BASE } from '@/data/_client/api'
import type { NeedsRingsWire, NeedsSummary } from '@/data/needs/needsApi'
import { applyMockNeedsClose, NEEDS_SUMMARY_KEY, useNeedsSummary } from '@/data/needs/needsHooks'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const DATE = '2026-07-20'

const ALL_GREEN: NeedsRingsWire = { energia: 80, hidratacio: 75, pihenes: 90, mozgas: 60, lelek: 100, rend: 65 }
const THREE_GREEN: NeedsRingsWire = { energia: 80, hidratacio: 75, pihenes: 90, mozgas: 20, lelek: 10, rend: 5 }

function seededWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return { client, Wrapper: ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  ) }
}

describe('useNeedsSummary (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('defaults to { streakDays: 0 }', () => {
    const { result } = renderHook(() => useNeedsSummary(), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual({ streakDays: 0 })
  })
})

describe('useNeedsSummary (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest-empty while unresolved, then the fetched summary', async () => {
    server.use(http.get(`${API_BASE}/api/needs/summary`, () =>
      HttpResponse.json({ streakDays: 4, lastCloseDate: DATE, lastAllGreen: true } satisfies NeedsSummary)))
    const { result } = renderHook(() => useNeedsSummary(), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual({ streakDays: 0 })
    await waitFor(() => expect(result.current.data.streakDays).toBe(4))
  })
})

describe('applyMockNeedsClose', () => {
  // `applyMockNeedsClose`/`awardGamificationEvent` is the MOCK-mode award mirror ("real mode
  // never calls this; the backend awards server-side") — it must run against `useGamification()`
  // in mock mode too, or the hook's real-mode arm kicks off an actual (MSW-intercepted)
  // GET /api/gamification/profile fetch that resolves a tick after this file's synchronous
  // setQueryData call and clobbers it with the static real-mode fixture (totalXp: 860,
  // src/test/msw/handlers.ts) — every assertion then converges on 860 regardless of the
  // awarded delta. Pin mock mode so `useGamification()` never races a network fetch here.
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('all-green rings → streak 1, allGreen true, +60 XP', async () => {
    const { client, Wrapper } = seededWrapper()
    const { result } = renderHook(() => useGamification(), { wrapper: Wrapper })
    const before = result.current.profile.totalXp

    applyMockNeedsClose(client, DATE, ALL_GREEN)

    expect(client.getQueryData(NEEDS_SUMMARY_KEY)).toEqual({ streakDays: 1, lastCloseDate: DATE, lastAllGreen: true })
    await waitFor(() => expect(result.current.profile.totalXp).toBe(before + 60))
  })

  test('a second close on the SAME date is idempotent — no double award', async () => {
    const { client, Wrapper } = seededWrapper()
    const { result } = renderHook(() => useGamification(), { wrapper: Wrapper })
    const before = result.current.profile.totalXp

    applyMockNeedsClose(client, DATE, ALL_GREEN)
    await waitFor(() => expect(result.current.profile.totalXp).toBe(before + 60))

    applyMockNeedsClose(client, DATE, ALL_GREEN)
    expect(result.current.profile.totalXp).toBe(before + 60) // unchanged
    expect(client.getQueryData(NEEDS_SUMMARY_KEY)).toEqual({ streakDays: 1, lastCloseDate: DATE, lastAllGreen: true })
  })

  test('3-of-6 green rings → +15 XP, streak resets to 0, allGreen false', async () => {
    const { client, Wrapper } = seededWrapper()
    const { result } = renderHook(() => useGamification(), { wrapper: Wrapper })
    const before = result.current.profile.totalXp

    applyMockNeedsClose(client, DATE, THREE_GREEN)

    expect(client.getQueryData(NEEDS_SUMMARY_KEY)).toEqual({ streakDays: 0, lastCloseDate: DATE, lastAllGreen: false })
    await waitFor(() => expect(result.current.profile.totalXp).toBe(before + 15))
  })

  test('a prior streak +1s on a subsequent all-green close (different date)', async () => {
    const { client } = seededWrapper()
    client.setQueryData(NEEDS_SUMMARY_KEY, { streakDays: 3, lastCloseDate: '2026-07-19', lastAllGreen: true } satisfies NeedsSummary)

    applyMockNeedsClose(client, DATE, ALL_GREEN)

    expect(client.getQueryData(NEEDS_SUMMARY_KEY)).toEqual({ streakDays: 4, lastCloseDate: DATE, lastAllGreen: true })
  })
})
