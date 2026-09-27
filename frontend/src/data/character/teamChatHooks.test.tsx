import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useTeamChat, useTeamChatActions } from '@/data/character/teamChatHooks'
import { buildTeamChatDay, mockAnswer, mockReplyAfter, mockUndo, MOCK_TEAM_CHAT_DAY, OPEN_ID } from '@/data/character/teamChatMock'
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
      ['OPEN', 'falat'],
    ])

    const userLine = day.lines.find((l) => l.kind === 'USER')
    expect(userLine?.body).toBe('Rizses csirkét ettem, dupla adag rizzsel.')

    // Three OPEN ügy remain open (sleep_debt, sustained_stress, the seeded EXCUSE-offer
    // late_eating); load_fuel_mismatch resolved at 13:05.
    expect(day.openThreads).toHaveLength(3)
    const [sleepDebt, sustainedStress, lateEating] = day.openThreads
    expect(sleepDebt.flagKey).toBe('sleep_debt')
    expect(sleepDebt.ruleLabel).toBe('Alvásadósság')
    expect(sleepDebt.pushed).toBe(true)
    expect(sleepDebt.actions).toEqual([{ key: 'shift_sleep_anchor', label: 'Horgony −30 perc' }])
    expect(sustainedStress.flagKey).toBe('sustained_stress')
    expect(sustainedStress.ruleLabel).toBe('Tartós stressz')
    expect(sustainedStress.pushed).toBe(false)
    expect(lateEating.id).toBe(OPEN_ID)
    expect(lateEating.flagKey).toBe('late_eating')
    expect(lateEating.offer).toBe('EXCUSE')
    expect(lateEating.offerTag).toBe('meccsnap')

    const loadFuelLine = day.lines.find((l) => l.kind === 'OPEN' && l.character === 'mocor')
    expect(loadFuelLine?.thread?.status).toBe('RESOLVED')
    expect(loadFuelLine?.thread?.ruleLabel).toBe('Terhelés–táplálás')
  })

  test('buildTeamChatDay anchors occurredAt timestamps to the requested date', () => {
    const day = buildTeamChatDay('2026-01-05')
    expect(day.date).toBe('2026-01-05')
    expect(day.lines[0].occurredAt.startsWith('2026-01-05T07:40:00')).toBe(true)
  })

  test('useTeamChatActions.apply is a no-op in mock mode', async () => {
    const { result } = renderHook(() => useTeamChatActions(), { wrapper: makeHookWrapper() })
    await act(async () => {
      result.current.apply('tc-thread-sleep-debt', 'shift_sleep_anchor')
    })
    await waitFor(() => expect(result.current.pending).toBe(false))
  })

  test('mock reply with a concrete reason appends USER + REPLY and closes with remembered', async () => {
    const day = mockReplyAfter(MOCK_TEAM_CHAT_DAY, OPEN_ID, '10-kor ért véget a röpi kupa')
    const reply = day.lines.at(-1)!
    expect(reply.kind).toBe('REPLY')
    expect(reply.thread?.closeReason).toBe('REPLY')
    expect(reply.thread?.remembered?.text).toMatch(/Meccsnapokon/)
    expect(day.openThreads.find((t) => t.id === OPEN_ID)).toBeUndefined()
  })

  test('mock reply without a reason answers and keeps the ügy open', async () => {
    const day = mockReplyAfter(MOCK_TEAM_CHAT_DAY, OPEN_ID, 'Bocs, csak elfelejtettem szólni.')
    const reply = day.lines.at(-1)!
    expect(reply.kind).toBe('REPLY')
    expect(reply.body).toBe('Értem, köszönöm, hogy elmondtad.')
    expect(reply.thread?.status).toBe('OPEN')
    expect(day.openThreads.find((t) => t.id === OPEN_ID)?.status).toBe('OPEN')
  })

  test.each([
    ['EXCUSED', 'Rendben, akkor ez most is kivétel volt.', 'EXCUSED', 'meccsnap'],
    ['KEEP', 'Rendben, akkor marad így — tovább figyelek.', 'EXCUSED', 'meccsnap'],
    ['STOP', 'Rendben, akkor újra szólok, ha előjön.', 'REPLY', 'kivétel kikapcsolva'],
  ] as const)('mockAnswer(%s) sets the exact body + closeReason/closeNote', (choice, body, closeReason, closeNote) => {
    const day = mockAnswer(MOCK_TEAM_CHAT_DAY, OPEN_ID, choice)
    const line = day.lines.at(-1)!
    expect(line.kind).toBe('REPLY')
    expect(line.body).toBe(body)
    expect(line.thread?.status).toBe('RESOLVED')
    expect(line.thread?.closeReason).toBe(closeReason)
    expect(line.thread?.closeNote).toBe(closeNote)
    expect(line.thread?.offer).toBeNull()
    expect(day.openThreads.find((t) => t.id === OPEN_ID)).toBeUndefined()
  })

  test('mockUndo deactivates the remembered chip and reopens a REPLY-closed ügy', () => {
    const closed = mockReplyAfter(MOCK_TEAM_CHAT_DAY, OPEN_ID, '10-kor ért véget a röpi kupa')
    const undone = mockUndo(closed, OPEN_ID)
    const thread = undone.lines.find((l) => l.threadId === OPEN_ID && l.thread != null)!.thread!
    expect(thread.remembered?.active).toBe(false)
    expect(thread.status).toBe('OPEN')
    expect(thread.closedAt).toBeNull()
    expect(thread.closeReason).toBeNull()
    expect(thread.closeNote).toBeNull()
    expect(undone.openThreads.find((t) => t.id === OPEN_ID)?.status).toBe('OPEN')
  })

  test('mockUndo deactivates the remembered chip but does NOT reopen an EXCUSED-closed ügy', () => {
    // mockAnswer never sets `remembered` itself — seed it directly to isolate mockUndo's own
    // reopen-only-on-REPLY rule from mockAnswer's own behaviour.
    const answered = mockAnswer(MOCK_TEAM_CHAT_DAY, OPEN_ID, 'EXCUSED')
    const withRemembered = {
      ...answered,
      lines: answered.lines.map((l) => (l.threadId === OPEN_ID && l.thread != null)
        ? { ...l, thread: { ...l.thread, remembered: { text: 'x', contextTag: 'meccsnap', active: true } } }
        : l),
    }
    const undone = mockUndo(withRemembered, OPEN_ID)
    const thread = undone.lines.find((l) => l.threadId === OPEN_ID && l.thread != null)!.thread!
    expect(thread.remembered?.active).toBe(false)
    expect(thread.status).toBe('RESOLVED')
    expect(thread.closeReason).toBe('EXCUSED')
  })

  test('useTeamChatActions.reply in mock mode: awaiting, then the synthetic REPLY lands after the typing delay', async () => {
    vi.useFakeTimers()
    try {
      const { wrapper, client } = makeHookWrapperWithClient()
      client.setQueryData(['teamChat', null], MOCK_TEAM_CHAT_DAY)
      const { result } = renderHook(() => useTeamChatActions(), { wrapper })

      let resolved = false
      act(() => { result.current.reply(OPEN_ID, 'Elment a meccsnap miatt').then(() => { resolved = true }) })
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(result.current.awaiting.has(OPEN_ID)).toBe(true)
      expect(resolved).toBe(false)

      await act(async () => { await vi.advanceTimersByTimeAsync(1200) })

      expect(resolved).toBe(true)
      expect(result.current.awaiting.has(OPEN_ID)).toBe(false)
      const day = client.getQueryData<TeamChatDay>(['teamChat', null])!
      expect(day.lines.at(-1)?.kind).toBe('REPLY')
    } finally {
      vi.useRealTimers()
    }
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

  test('real answer() posts the choice and invalidates the day', async () => {
    let body: unknown = null
    server.use(
      http.post(`${API_BASE}/api/character/team-chat/threads/:threadId/answer`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          id: OPEN_ID, flagKey: 'late_eating', ruleLabel: 'Késői étkezés', owner: 'falat', guest: null,
          status: 'RESOLVED', openedAt: new Date().toISOString(), closedAt: new Date().toISOString(),
          pushed: false, actions: [], applied: null, closeReason: 'EXCUSED', closeNote: 'meccsnap',
          offer: null, offerTag: null, remembered: null,
        })
      }),
    )
    const { wrapper, client } = makeHookWrapperWithClient()
    client.setQueryData(['teamChat', null], { date: localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 })

    const { result } = renderHook(() => useTeamChatActions(), { wrapper })
    result.current.answer(OPEN_ID, 'EXCUSED')

    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(body).toEqual({ choice: 'EXCUSED' })
    expect(client.getQueryState(['teamChat', null])?.isInvalidated).toBe(true)
  })

  test('real undoRemembered() sends DELETE', async () => {
    let method: string | null = null
    server.use(
      http.delete(`${API_BASE}/api/character/team-chat/threads/:threadId/remembered`, ({ request }) => {
        method = request.method
        return HttpResponse.json({
          id: OPEN_ID, flagKey: 'late_eating', ruleLabel: 'Késői étkezés', owner: 'falat', guest: null,
          status: 'OPEN', openedAt: new Date().toISOString(), closedAt: null,
          pushed: false, actions: [], applied: null, closeReason: null, closeNote: null,
          offer: null, offerTag: null, remembered: null,
        })
      }),
    )
    const { wrapper, client } = makeHookWrapperWithClient()
    client.setQueryData(['teamChat', null], { date: localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 })

    const { result } = renderHook(() => useTeamChatActions(), { wrapper })
    result.current.undoRemembered(OPEN_ID)

    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(method).toBe('DELETE')
    expect(client.getQueryState(['teamChat', null])?.isInvalidated).toBe(true)
  })

  test('reply marks the thread awaiting; once the backoff runs out it LEAVES awaiting and polling falls back to 60s', async () => {
    vi.useFakeTimers()
    try {
      server.use(
        http.post(`${API_BASE}/api/character/team-chat/threads/:threadId/reply`, () =>
          HttpResponse.json({
            id: 'new-line', threadId: OPEN_ID, kind: 'USER', character: null,
            body: 'kösz!', voiced: false, facts: [], occurredAt: new Date().toISOString(),
          })),
        http.get(`${API_BASE}/api/character/team-chat`, () =>
          HttpResponse.json({ date: localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 })),
      )
      const { wrapper, client } = makeHookWrapperWithClient()
      renderHook(() => useTeamChat(), { wrapper })
      const actionsHook = renderHook(() => useTeamChatActions(), { wrapper })
      await vi.advanceTimersByTimeAsync(0)

      actionsHook.result.current.reply(OPEN_ID, 'kösz!')
      await vi.advanceTimersByTimeAsync(0)
      expect(client.getQueryData<ReadonlyMap<string, number>>(['teamChat', 'awaiting'])?.has(OPEN_ID)).toBe(true)

      // The answer never actually lands (the GET handler always serves the empty day). At 10s
      // (the old, too-short budget) the thread is still awaiting — a real LLM answer often takes
      // longer than that.
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(3000)
      await vi.advanceTimersByTimeAsync(5000)
      expect(client.getQueryData<ReadonlyMap<string, number>>(['teamChat', 'awaiting'])?.has(OPEN_ID)).toBe(true)
      await vi.advanceTimersByTimeAsync(10_000)
      expect(client.getQueryData<ReadonlyMap<string, number>>(['teamChat', 'awaiting'])?.has(OPEN_ID)).toBe(true)
      // The backoff (2s + 3s + 5s + 10s + 10s = 30s since the thread JOINED awaiting) runs out
      // here — this is the binding resolution: the thread must LEAVE `awaiting`, not just stop
      // being polled fast.
      await vi.advanceTimersByTimeAsync(10_000)
      expect(client.getQueryData<ReadonlyMap<string, number>>(['teamChat', 'awaiting'])?.has(OPEN_ID)).toBe(false)

      // And nothing breaks once it falls back to the plain 60s poll.
      await vi.advanceTimersByTimeAsync(60_000)
      expect(client.getQueryData<ReadonlyMap<string, number>>(['teamChat', 'awaiting'])?.has(OPEN_ID)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  test('a thread that joins mid-backoff of another still gets its own full backoff', async () => {
    vi.useFakeTimers()
    try {
      server.use(
        http.post(`${API_BASE}/api/character/team-chat/threads/:threadId/reply`, ({ params }) =>
          HttpResponse.json({
            id: `new-line-${params.threadId as string}`, threadId: params.threadId as string, kind: 'USER',
            character: null, body: 'kösz!', voiced: false, facts: [], occurredAt: new Date().toISOString(),
          })),
        http.get(`${API_BASE}/api/character/team-chat`, () =>
          HttpResponse.json({ date: localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 })),
      )
      const THREAD_A = OPEN_ID
      const THREAD_B = 'tc-thread-sleep-debt'
      const { wrapper, client } = makeHookWrapperWithClient()
      renderHook(() => useTeamChat(), { wrapper })
      const actionsHook = renderHook(() => useTeamChatActions(), { wrapper })
      await vi.advanceTimersByTimeAsync(0)

      const awaiting = () => client.getQueryData<ReadonlyMap<string, number>>(['teamChat', 'awaiting'])

      actionsHook.result.current.reply(THREAD_A, 'kösz!')
      await vi.advanceTimersByTimeAsync(0)

      // B joins 4s into A's own 30s budget.
      await vi.advanceTimersByTimeAsync(4000)
      actionsHook.result.current.reply(THREAD_B, 'kösz!')
      await vi.advanceTimersByTimeAsync(0)
      expect(awaiting()?.has(THREAD_A)).toBe(true)
      expect(awaiting()?.has(THREAD_B)).toBe(true)

      // 26s later (30s since A joined): A's own budget is spent — it leaves. B (joined 4s later)
      // has only used 26s of ITS own 30s budget, unaffected by A's shorter remaining wait — it stays.
      await vi.advanceTimersByTimeAsync(26_000)
      expect(awaiting()?.has(THREAD_A)).toBe(false)
      expect(awaiting()?.has(THREAD_B)).toBe(true)

      // A further 4s (30s since B joined): B's own full budget is now spent too.
      await vi.advanceTimersByTimeAsync(4000)
      expect(awaiting()?.has(THREAD_B)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
