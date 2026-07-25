import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import {
  useGamification,
  useGamificationActions,
  useGamificationDay,
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

  test('useGamificationDay seeds the deterministic mockup numbers synchronously', () => {
    const { result } = renderHook(() => useGamificationDay('2026-07-20'), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual({
      date: '2026-07-20',
      xpBySource: [
        { source: 'QUEST', xp: 45 },
        { source: 'HABIT', xp: 35 },
        { source: 'ACTIVITY', xp: 15 },
        { source: 'GYM', xp: 20 },
      ],
      xpTotal: 115,
      coinEvents: [
        { reason: 'quest', amount: 10 },
        { reason: 'all3', amount: 20 },
      ],
      coinTotal: 30,
      streakDays: 12,
      streakAlive: true,
    })
    expect(result.current.isPending).toBe(false)
  })
})

describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('ghost profile while unresolved, then maps the MSW profile fixture', async () => {
    server.use(
      http.get(`${API_BASE}/api/gamification/profile`, () =>
        HttpResponse.json({
          totalXp: 1250, level: 8, xpInLevel: 90, xpForNext: 300,
          coins: 77, streakDays: 9, streakAlive: true, streakSavers: 2,
          equippedTitleKey: 'gainz-nagyur', ownedTitleKeys: ['gainz-nagyur', 'kezdo-kanal'],
        }),
      ),
    )
    const { result } = renderHook(() => useGamification(), { wrapper: makeHookWrapper() })
    expect(result.current.profile.level).toBe(1) // realEmpty ghost while loading
    expect(result.current.profile.coins).toBe(0)
    await waitFor(() => expect(result.current.profile.level).toBe(8))
    expect(result.current.profile).toMatchObject({
      totalXp: 1250, level: 8, xpInLevel: 90, xpForNext: 300,
      coins: 77, streakDays: 9, streakSavers: 2,
      activeTitleKey: 'gainz-nagyur',
      ownedShopTitleKeys: ['gainz-nagyur', 'kezdo-kanal'],
    })
  })

  test('canMutate is true in real mode too', () => {
    const { result } = renderHook(() => useGamificationActions(), { wrapper: makeHookWrapper() })
    expect(result.current.canMutate).toBe(true)
  })

  test('buyTitle POSTs to the buy endpoint and invalidates the profile', async () => {
    const state = { coins: 100, equippedTitleKey: 'ujonc', ownedTitleKeys: [] as string[] }
    server.use(
      http.get(`${API_BASE}/api/gamification/profile`, () =>
        HttpResponse.json({
          totalXp: 0, level: 1, xpInLevel: 0, xpForNext: 80,
          coins: state.coins, streakDays: 0, streakAlive: false, streakSavers: 0,
          equippedTitleKey: state.equippedTitleKey, ownedTitleKeys: state.ownedTitleKeys,
        }),
      ),
      http.post(`${API_BASE}/api/gamification/title/:key/buy`, ({ params }) => {
        state.coins = 40
        state.equippedTitleKey = String(params.key)
        state.ownedTitleKeys = [String(params.key)]
        return HttpResponse.json({
          totalXp: 0, level: 1, xpInLevel: 0, xpForNext: 80,
          coins: state.coins, streakDays: 0, streakAlive: false, streakSavers: 0,
          equippedTitleKey: state.equippedTitleKey, ownedTitleKeys: state.ownedTitleKeys,
        })
      }),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ g: useGamification(), a: useGamificationActions() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.g.profile.coins).toBe(100))
    act(() => result.current.a.buyTitle('csirkemell-csodaja'))
    await waitFor(() => expect(result.current.g.profile.coins).toBe(40))
    expect(result.current.g.profile.activeTitleKey).toBe('csirkemell-csodaja')
    expect(result.current.g.profile.ownedShopTitleKeys).toContain('csirkemell-csodaja')
  })

  test('equipTitle and buyStreakSaver also POST + invalidate', async () => {
    const state = { coins: 300, streakSavers: 0, equippedTitleKey: 'ujonc' }
    server.use(
      http.get(`${API_BASE}/api/gamification/profile`, () =>
        HttpResponse.json({
          totalXp: 0, level: 1, xpInLevel: 0, xpForNext: 80,
          coins: state.coins, streakDays: 0, streakAlive: false, streakSavers: state.streakSavers,
          equippedTitleKey: state.equippedTitleKey, ownedTitleKeys: ['vasakarat'],
        }),
      ),
      http.post(`${API_BASE}/api/gamification/title/:key/equip`, ({ params }) => {
        state.equippedTitleKey = String(params.key)
        return HttpResponse.json({
          totalXp: 0, level: 1, xpInLevel: 0, xpForNext: 80,
          coins: state.coins, streakDays: 0, streakAlive: false, streakSavers: state.streakSavers,
          equippedTitleKey: state.equippedTitleKey, ownedTitleKeys: ['vasakarat'],
        })
      }),
      http.post(`${API_BASE}/api/gamification/saver/buy`, () => {
        state.coins = 100
        state.streakSavers = 1
        return HttpResponse.json({
          totalXp: 0, level: 1, xpInLevel: 0, xpForNext: 80,
          coins: state.coins, streakDays: 0, streakAlive: false, streakSavers: state.streakSavers,
          equippedTitleKey: state.equippedTitleKey, ownedTitleKeys: ['vasakarat'],
        })
      }),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ g: useGamification(), a: useGamificationActions() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.g.profile.coins).toBe(300))
    act(() => result.current.a.equipTitle('vasakarat'))
    await waitFor(() => expect(result.current.g.profile.activeTitleKey).toBe('vasakarat'))
    act(() => result.current.a.buyStreakSaver())
    await waitFor(() => expect(result.current.g.profile.streakSavers).toBe(1))
    expect(result.current.g.profile.coins).toBe(100)
  })

  test('404 → ghost profile', async () => {
    server.use(
      http.get(`${API_BASE}/api/gamification/profile`, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    )
    const { result } = renderHook(() => useGamification(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.profile.level).toBe(1)
    expect(result.current.profile.totalXp).toBe(0)
  })

  test('useGamificationDay: honest-zero ghost while unresolved, then maps the MSW day fixture', async () => {
    server.use(
      http.get(`${API_BASE}/api/gamification/day/:date`, ({ params }) =>
        HttpResponse.json({
          date: String(params.date),
          xpBySource: [{ source: 'GYM', xp: 20 }, { source: 'QUEST', xp: 45 }],
          xpTotal: 65,
          coinEvents: [{ reason: 'quest', amount: 10 }],
          coinTotal: 10,
          streakDays: 3,
          streakAlive: true,
        }),
      ),
    )
    const { result } = renderHook(() => useGamificationDay('2026-07-20'), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual({
      date: '2026-07-20', xpBySource: [], xpTotal: 0, coinEvents: [], coinTotal: 0,
      streakDays: 0, streakAlive: false,
    })
    await waitFor(() => expect(result.current.data.xpTotal).toBe(65))
    expect(result.current.data.streakDays).toBe(3)
    expect(result.current.data.coinEvents).toEqual([{ reason: 'quest', amount: 10 }])
  })
})
