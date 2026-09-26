import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useTeamChat, useTeamChatActions } from '@/data/character/teamChatHooks'
import { buildTeamChatDay, MOCK_TEAM_CHAT_DAY } from '@/data/character/teamChatMock'
import type { TeamChatDay, TeamChatThread } from '@/data/character/teamChatApi'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper, makeHookWrapperWithClient } from '@/test/queryWrapper'
import { localDateString } from '@/shared/lib/dates'

// ---------------------------------------------------------------------------
// mock mode
// ---------------------------------------------------------------------------
describe('mock mode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('useTeamChat returns the seeded day', async () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.day).toEqual(MOCK_TEAM_CHAT_DAY)
  })

  test('the seed matches the prototype day (Szunya + Szkeptikus, Mocor + Falat + USER + resolve, Derű silent)', async () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { day } = result.current

    expect(day.date).toBe(localDateString())
    expect(day.pushesToday).toBe(2)
    expect(day.pushBudget).toBe(2)

    const kinds = day.lines.map((l) => [l.kind, l.character])
    expect(kinds).toEqual([
      ['OPEN', 'szunya'],
      ['SKEPTIC', 'szkeptikus'],
      ['OPEN', 'mocor'],
      ['GUEST', 'falat'],
      ['USER', null],
      ['RESOLVE', 'falat'],
      ['GUEST', 'mocor'],
      ['OPEN', 'deru'],
    ])

    const userLine = day.lines.find((l) => l.kind === 'USER')
    expect(userLine?.body).toBe('Rizses csirkét ettem, dupla adag rizzsel.')

    // Two OPEN ügy remain open (sleep_debt, sustained_stress); load_fuel_mismatch resolved at 13:05.
    expect(day.openThreads).toHaveLength(2)
    const [sleepDebt, sustainedStress] = day.openThreads
    expect(sleepDebt.flagKey).toBe('sleep_debt')
    expect(sleepDebt.ruleLabel).toBe('Alvásadósság')
    expect(sleepDebt.pushed).toBe(true)
    expect(sleepDebt.actions).toEqual([{ key: 'shift_sleep_anchor', label: 'Horgony −30 perc' }])
    expect(sustainedStress.flagKey).toBe('sustained_stress')
    expect(sustainedStress.ruleLabel).toBe('Tartós stressz')
    expect(sustainedStress.pushed).toBe(false)

    const loadFuelLine = day.lines.find((l) => l.kind === 'OPEN' && l.character === 'mocor')
    expect(loadFuelLine?.thread?.status).toBe('RESOLVED')
    expect(loadFuelLine?.thread?.ruleLabel).toBe('Terhelés–táplálás')
  })

  test('buildTeamChatDay anchors occurredAt timestamps to the requested date', () => {
    const day = buildTeamChatDay('2026-01-05')
    expect(day.date).toBe('2026-01-05')
    expect(day.lines[0].occurredAt.startsWith('2026-01-05T07:40:00')).toBe(true)
  })

  test('useTeamChatActions reply/apply are no-ops in mock mode', async () => {
    const { result } = renderHook(() => useTeamChatActions(), { wrapper: makeHookWrapper() })
    await act(async () => {
      result.current.reply('tc-thread-sleep-debt', 'kösz!')
    })
    await waitFor(() => expect(result.current.pending).toBe(false))
    await act(async () => {
      result.current.apply('tc-thread-sleep-debt', 'shift_sleep_anchor')
    })
    await waitFor(() => expect(result.current.pending).toBe(false))
  })

  test('useTeamChat never polls in mock mode, even after minutes (mezo-a9bo7.24 fix round 1)', async () => {
    vi.useFakeTimers()
    try {
      const { wrapper, client } = makeHookWrapperWithClient()
      renderHook(() => useTeamChat(), { wrapper })
      const before = client.getQueryState(['teamChat', null])?.dataUpdatedAt
      await vi.advanceTimersByTimeAsync(5 * 60_000)
      const after = client.getQueryState(['teamChat', null])?.dataUpdatedAt
      expect(after).toBe(before)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ---------------------------------------------------------------------------
// real mode
// ---------------------------------------------------------------------------
describe('real mode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('useTeamChat defaults to the honest empty day (realEmpty) with no server.use() override', async () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.day).toEqual({ date: localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 })
  })

  test('useTeamChat maps the DTO through and passes the date query param', async () => {
    let requestedDate: string | null = null
    const seeded: TeamChatDay = { date: '2026-02-10', lines: [], openThreads: [], pushesToday: 1, pushBudget: 2 }
    server.use(
      http.get(`${API_BASE}/api/character/team-chat`, ({ request }) => {
        requestedDate = new URL(request.url).searchParams.get('date')
        return HttpResponse.json(seeded)
      }),
    )
    const { result } = renderHook(() => useTeamChat('2026-02-10'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.day).toEqual(seeded))
    expect(requestedDate).toBe('2026-02-10')
  })

  test('useTeamChat polls every 60s in real mode (mezo-a9bo7.24 fix round 1 — the chat is genuinely live)', async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      server.use(
        http.get(`${API_BASE}/api/character/team-chat`, () => {
          calls += 1
          return HttpResponse.json({ date: localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 })
        }),
      )
      renderHook(() => useTeamChat(), { wrapper: makeHookWrapper() })
      await vi.advanceTimersByTimeAsync(0)
      expect(calls).toBe(1)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(calls).toBe(2)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(calls).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  test('reply invalidates every cached teamChat query key', async () => {
    server.use(
      http.post(`${API_BASE}/api/character/team-chat/threads/:threadId/reply`, () =>
        HttpResponse.json({
          id: 'new-line', threadId: 'tc-thread-sleep-debt', kind: 'USER', character: null,
          body: 'kösz!', voiced: false, facts: [], occurredAt: new Date().toISOString(),
        }),
      ),
    )
    const { wrapper, client } = makeHookWrapperWithClient()
    client.setQueryData(['teamChat', null], { date: localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 })
    client.setQueryData(['teamChat', '2026-02-10'], { date: '2026-02-10', lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 })

    const { result } = renderHook(() => useTeamChatActions(), { wrapper })
    result.current.reply('tc-thread-sleep-debt', 'kösz!')

    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(client.getQueryState(['teamChat', null])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['teamChat', '2026-02-10'])?.isInvalidated).toBe(true)
  })

  test('apply invalidates teamChat AND the action-key extra query (shift_sleep_anchor -> sleepGoal/habitDay/fuelDay)', async () => {
    const appliedThread: TeamChatThread = {
      id: 'tc-thread-sleep-debt', flagKey: 'sleep_debt', ruleLabel: 'Alvásadósság', owner: 'szunya',
      guest: 'szkeptikus', status: 'RESOLVED', openedAt: new Date().toISOString(), closedAt: new Date().toISOString(),
      pushed: true, actions: [{ key: 'shift_sleep_anchor', label: 'Horgony −30 perc' }], applied: 'shift_sleep_anchor',
    }
    server.use(
      http.post(`${API_BASE}/api/character/team-chat/threads/:threadId/apply/:actionKey`, () => HttpResponse.json(appliedThread)),
    )
    const { wrapper, client } = makeHookWrapperWithClient()
    client.setQueryData(['teamChat', null], { date: localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 })
    client.setQueryData(['sleepGoal'], {})
    client.setQueryData(['habitDay'], {})
    client.setQueryData(['fuelDay'], {})
    client.setQueryData(['train', 'sportSlotSkips', '2026-09-07'], [])

    const { result } = renderHook(() => useTeamChatActions(), { wrapper })
    result.current.apply('tc-thread-sleep-debt', 'shift_sleep_anchor')

    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(client.getQueryState(['teamChat', null])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['sleepGoal'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['habitDay'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['fuelDay'])?.isInvalidated).toBe(true)
    // Unrelated key (a different action's own extra invalidation) must stay untouched.
    expect(client.getQueryState(['train', 'sportSlotSkips', '2026-09-07'])?.isInvalidated).toBe(false)
  })
})
