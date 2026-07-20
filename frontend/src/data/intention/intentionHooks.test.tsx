import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useIntentionDay, useIntentionActions } from '@/data/intention/intentionHooks'
import { API_BASE } from '@/data/_client/api'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import type { IntentionDay } from '@/data/types'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

// awardGamificationEvent is a side effect of the first focus of the day — spy on it
// (vi.mock is hoisted; the top-level import below resolves to the mocked fn).
vi.mock('@/data/gamification/gamificationStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/gamification/gamificationStore')>()
  return { ...actual, awardGamificationEvent: vi.fn() }
})
const awardMock = vi.mocked(awardGamificationEvent)

const DATE = '2026-07-20'

/** Wrapper backed by a client whose ['intentionDay', DATE] cache is pre-seeded to `day`. */
function seededWrapper(day: IntentionDay) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['intentionDay', DATE], day)
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

const dayWith = (foci: IntentionDay['foci']): IntentionDay => ({
  date: DATE,
  creed: null,
  foci,
  reflection: null,
  focusCap: 3,
})

describe('useIntentionDay (mock mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    awardMock.mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  test('serves the seed synchronously (creed + foci)', () => {
    const { result } = renderHook(() => useIntentionDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.data.creed).toBeTruthy()
    expect(result.current.data.focusCap).toBe(3)
  })

  test('addFocus appends within the cap', async () => {
    const wrapper = makeHookWrapper()
    const day = renderHook(() => useIntentionDay(DATE), { wrapper })
    const actions = renderHook(() => useIntentionActions(DATE), { wrapper })
    const before = day.result.current.data.foci.length
    await act(() => actions.result.current.addFocus('Új fókusz.'))
    await waitFor(() => expect(day.result.current.data.foci.length).toBe(before + 1))
  })

  test('first focus of the day awards HABIT xp exactly once', async () => {
    const wrapper = seededWrapper(dayWith([]))
    const actions = renderHook(() => useIntentionActions(DATE), { wrapper })

    await act(() => actions.result.current.addFocus('Első fókusz.'))
    expect(awardMock).toHaveBeenCalledTimes(1)
    expect(awardMock).toHaveBeenCalledWith(expect.anything(), { type: 'HABIT', xpOverride: 10 })

    // A second focus is NOT the first of the day → no further award.
    await act(() => actions.result.current.addFocus('Második fókusz.'))
    expect(awardMock).toHaveBeenCalledTimes(1)
  })

  test('respects the focus cap of 3', async () => {
    const atCap = dayWith([
      { id: 'if1', focusDate: DATE, text: 'Egy.' },
      { id: 'if2', focusDate: DATE, text: 'Kettő.' },
      { id: 'if3', focusDate: DATE, text: 'Három.' },
    ])
    const wrapper = seededWrapper(atCap)
    const day = renderHook(() => useIntentionDay(DATE), { wrapper })
    const actions = renderHook(() => useIntentionActions(DATE), { wrapper })

    await act(() => actions.result.current.addFocus('Negyedik — nem fér be.'))

    expect(day.result.current.data.foci).toHaveLength(3)
    expect(awardMock).not.toHaveBeenCalled()
  })
})

describe('useIntentionDay (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest-empty while unresolved — never the seed', () => {
    const { result } = renderHook(() => useIntentionDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.data.foci).toHaveLength(0)
    expect(result.current.data.creed).toBeNull()
  })

  test('maps the wire day', async () => {
    server.use(http.get(`${API_BASE}/api/intention/day/${DATE}`, () =>
      HttpResponse.json({
        date: DATE,
        creed: 'Élő hitvallás.',
        foci: [{ id: 'if-live', focusDate: DATE, text: 'Élő fókusz.' }],
        reflection: 'partial',
        focusCap: 3,
      })))
    const { result } = renderHook(() => useIntentionDay(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data.foci).toHaveLength(1))
    expect(result.current.data.creed).toBe('Élő hitvallás.')
    expect(result.current.data.reflection).toBe('partial')
  })
})
