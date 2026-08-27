import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMeWeek } from '@/data/me/meWeekHooks'
import { mockMeWeek, mockMeWeekStart } from '@/data/me/meWeek'
import { makeHookWrapper } from '@/test/queryWrapper'

// --- useMeWeek (mock mode) — the seed, re-dated to whatever Monday is requested ---

describe('useMeWeek (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('returns the demo seed synchronously for the seed Monday', () => {
    const { result } = renderHook(() => useMeWeek(mockMeWeekStart), { wrapper: makeHookWrapper() })
    expect(result.current.mode).toBe('mock')
    expect(result.current.week).toEqual(mockMeWeek(mockMeWeekStart))
    expect(result.current.week?.days).toHaveLength(7)
    // one genuine "tanulom" day: score null AND no data logged at all
    const tanulom = result.current.week?.days.find((d) => d.checkinCount === 0 && d.workoutCount === 0)
    expect(tanulom?.score).toBeNull()
    expect(tanulom?.kcal).toBeNull()
  })

  it('re-dates the seed to any requested Monday, keeping the same day shapes', () => {
    const { result } = renderHook(() => useMeWeek('2026-06-01'), { wrapper: makeHookWrapper() })
    expect(result.current.week?.start).toBe('2026-06-01')
    expect(result.current.week?.days[0].date).toBe('2026-06-01')
    expect(result.current.week?.days[6].date).toBe('2026-06-07')
  })
})

// --- useMeWeek (real mode) — the fetched week; NEVER the mock seed while unresolved ---

describe('useMeWeek (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('starts with an honest-empty week (not the seed) and resolves to the fetched week', async () => {
    const { result } = renderHook(() => useMeWeek('2026-05-18'), { wrapper: makeHookWrapper() })

    // realEmpty invariant: the very first render must not be the mock seed.
    expect(result.current.week).toBeNull()
    expect(result.current.mode).toBe('live')

    await waitFor(() => expect(result.current.week).not.toBeNull())
    expect(result.current.week?.start).toBe('2026-05-18')
    expect(result.current.week?.days[0].score).toBe(65)
    expect(result.current.week).not.toEqual(mockMeWeek('2026-05-18'))
  })
})
