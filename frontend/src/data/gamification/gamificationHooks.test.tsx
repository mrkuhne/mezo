import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import {
  useGamification,
  useGamificationActions,
  useTitles,
} from '@/data/gamification/gamificationHooks'
import { makeHookWrapper } from '@/test/queryWrapper'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'

afterEach(() => vi.unstubAllEnvs())

describe('mock mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('profile seeds synchronously from the mock', () => {
    const { result } = renderHook(() => useGamification(), { wrapper: makeHookWrapper() })
    expect(result.current.profile.level).toBe(12)
    expect(result.current.profile.coins).toBe(240)
  })

  test('titles derive owned/equipped from the profile', () => {
    const { result } = renderHook(() => useTitles(), { wrapper: makeHookWrapper() })
    const byKey = Object.fromEntries(result.current.titles.map((t) => [t.key, t]))
    expect(byKey['fegyelmezett']).toMatchObject({ owned: true, equipped: true }) // Lv 12
    expect(byKey['vasakarat'].owned).toBe(false) // Lv 16 locked
    expect(byKey['csirkemell-csodaja'].owned).toBe(false) // shop, not bought
  })

  test('buyTitle deducts coins, owns and auto-equips; insufficient coins is a no-op', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ g: useGamification(), t: useTitles(), a: useGamificationActions() }),
      { wrapper },
    )
    act(() => result.current.a.buyTitle('gainz-nagyur')) // 600 > 240
    expect(result.current.g.profile.coins).toBe(240)
    act(() => result.current.a.buyTitle('csirkemell-csodaja')) // 150
    await waitFor(() => expect(result.current.g.profile.coins).toBe(90))
    expect(result.current.g.profile.ownedShopTitleKeys).toContain('csirkemell-csodaja')
    expect(result.current.g.profile.activeTitleKey).toBe('csirkemell-csodaja')
    act(() => result.current.a.equipTitle('fegyelmezett'))
    await waitFor(() => expect(result.current.g.profile.activeTitleKey).toBe('fegyelmezett'))
  })

  test('buyStreakSaver caps at 2 and needs 200 coins', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ g: useGamification(), a: useGamificationActions() }),
      { wrapper },
    )
    act(() => result.current.a.buyStreakSaver()) // 240 → 40, savers 1 → 2
    await waitFor(() => expect(result.current.g.profile.streakSavers).toBe(2))
    expect(result.current.g.profile.coins).toBe(40)
    act(() => result.current.a.buyStreakSaver()) // savers already max → no-op
    expect(result.current.g.profile.coins).toBe(40)
  })
})

describe('real mode (interim derivation, spec §8)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('derives level from Σ cumulativeXp of the real progression profile', async () => {
    server.use(
      http.get(`${API_BASE}/api/progression/profile`, () =>
        HttpResponse.json({
          athleteLevel: 3, streakWeeks: 2, savingsHuf30d: null, radarAxes: [], highlights: {},
          traits: { disciplinePct: null, consistencyWeeks: 2 },
          athletic: [{ skillKey: 'squat', kind: 'ATHLETIC', level: 3, cumulativeXp: 500, progressPct: 50 }],
          muscle: [],
          life: [{ skillKey: 'learning', kind: 'LIFE', level: 1, cumulativeXp: 60, progressPct: 75 }],
        }),
      ),
    )
    const { result } = renderHook(() => useGamification(), { wrapper: makeHookWrapper() })
    expect(result.current.profile.level).toBe(1) // realEmpty ghost while loading
    await waitFor(() => expect(result.current.profile.level).toBe(5)) // 560 XP
    expect(result.current.profile.totalXp).toBe(560)
    expect(result.current.profile.coins).toBe(0) // coins stay ghost until backend
  })

  test('actions are disabled (canMutate=false) and no-op', () => {
    const { result } = renderHook(() => useGamificationActions(), { wrapper: makeHookWrapper() })
    expect(result.current.canMutate).toBe(false)
  })

  test('404 → ghost profile', async () => {
    server.use(
      http.get(`${API_BASE}/api/progression/profile`, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    )
    const { result } = renderHook(() => useGamification(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.profile.level).toBe(1)
    expect(result.current.profile.totalXp).toBe(0)
  })
})
