import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useDailyQuests, useQuestActions, useQuestHistory } from '@/data/quest/questHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const DATE = '2026-07-11'

const questWire = (overrides: Record<string, unknown> = {}) => ({
  id: 'q-1',
  questDate: DATE,
  slot: 'FUELBIO',
  skillKey: 'recovery',
  title: 'Igyál meg legalább 2,5 litert ma',
  why: 'A hidratáltság a legolcsóbb teljesítményfokozó.',
  targetLabel: '≥ 2500 ml víz',
  metric: 'water_target',
  xp: 15,
  status: 'offered',
  completedAt: null,
  ...overrides,
})

describe('useDailyQuests (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps the day payload and exposes rerollsLeft + levelUps', async () => {
    server.use(
      http.get(`${API_BASE}/api/quest/day/${DATE}`, () =>
        HttpResponse.json({ date: DATE, quests: [questWire()], levelUps: [], rerollsLeft: 1 }),
      ),
    )
    const { result } = renderHook(() => useDailyQuests(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.quests).toHaveLength(1))
    expect(result.current.quests[0].targetLabel).toBe('≥ 2500 ml víz')
    expect(result.current.quests[0].metric).toBe('water_target')
    expect(result.current.rerollsLeft).toBe(1)
    expect(result.current.levelUps).toEqual([])
    expect(result.current.mode).toBe('live')
  })
})

describe('useQuestActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('reroll posts and invalidates the day query (refetch)', async () => {
    let getCalls = 0
    server.use(
      http.get(`${API_BASE}/api/quest/day/${DATE}`, () => {
        getCalls += 1
        return HttpResponse.json({ date: DATE, quests: [questWire()], levelUps: [], rerollsLeft: 1 })
      }),
      http.post(`${API_BASE}/api/quest/:id/reroll`, () =>
        HttpResponse.json(questWire({ id: 'q-2', title: 'Reggeli súlymérés — logold be' })),
      ),
    )
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useDailyQuests(DATE), { wrapper })
    const actions = renderHook(() => useQuestActions(DATE), { wrapper })
    await waitFor(() => expect(list.result.current.quests).toHaveLength(1))
    expect(getCalls).toBe(1)

    actions.result.current.reroll('q-1')
    await waitFor(() => expect(getCalls).toBe(2))
  })
})

describe('useDailyQuests (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the seed without fetching', async () => {
    const { result } = renderHook(() => useDailyQuests(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.mode).toBe('mock')
    expect(result.current.quests.length).toBeGreaterThan(0)
    expect(result.current.quests.some(q => q.status === 'completed')).toBe(true)
    expect(result.current.quests.every(q => q.metric.length > 0)).toBe(true)
  })
})

describe('useQuestHistory (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the 4-entry history seed synchronously', () => {
    const { result } = renderHook(() => useQuestHistory('2026-06-12', DATE), { wrapper: makeHookWrapper() })
    expect(result.current.data).toHaveLength(4)
    expect(result.current.data.every(q => q.status !== 'offered' && q.status !== 'rerolled')).toBe(true)
  })
})

describe('useQuestHistory (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('resolves the empty range from the default handler', async () => {
    const { result } = renderHook(() => useQuestHistory('2026-06-12', DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data).toEqual([])
  })
})
