import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { useDayRecap } from '@/data/ritual/recapHooks'
import { makeHookWrapper } from '@/test/queryWrapper'

afterEach(() => {
  vi.unstubAllEnvs()
})

const DATE = '2026-07-11'

describe('useDayRecap (real mode)', () => {
  test('composes a populated day: training done:true, fuel + protein, weight, sleep, journal, foci — in order', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/train/workouts/today`, () =>
        HttpResponse.json({
          templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
          dayLabel: 'Csü', title: 'Pull Day', durationEst: 78,
          exercises: [{
            id: 'c1f3a0e2-0000-4000-8000-000000000002', name: 'Row', muscle: 'back-mid', type: 'compound',
            warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null,
            prescribedSets: [], lastWeek: null,
          }],
          openWorkout: null,
          completedWorkout: { id: 'w-done', templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010', date: DATE, status: 'completed', sets: [] },
        }),
      ),
      http.get(`${API_BASE}/api/biometrics/weight`, () =>
        HttpResponse.json([{ id: 'w1', date: DATE, value: 79.4, note: null }]),
      ),
      http.get(`${API_BASE}/api/biometrics/checkin`, () =>
        HttpResponse.json([
          { id: 'c1', date: DATE, slotTime: '06:30', state: 'done', energy: 7, stress: 3, body: 6, mental: 7, note: null, savedAt: `${DATE}T06:31:00Z` },
          { id: 'c2', date: DATE, slotTime: '10:00', state: 'done', energy: 7, stress: 3, body: 6, mental: 7, note: null, savedAt: `${DATE}T10:01:00Z` },
          { id: 'c3', date: DATE, slotTime: '14:00', state: 'done', energy: 7, stress: 3, body: 6, mental: 7, note: null, savedAt: `${DATE}T14:01:00Z` },
        ]),
      ),
      http.get(`${API_BASE}/api/activity/day/:date`, () =>
        HttpResponse.json([
          { id: 'act1', occurredOn: DATE, text: 'Egy nagyon hosszú napló bejegyzés a mai napról, több mint negyven karakter hosszan', skillKey: 'learning', confidence: 0.9, xpAwarded: 18, durationMin: null, amountHuf: null, categorizedBy: 'AI' },
          { id: 'act2', occurredOn: DATE, text: 'Rövid jegyzet', skillKey: null, confidence: 0.4, xpAwarded: 0, durationMin: null, amountHuf: null, categorizedBy: null },
        ]),
      ),
      http.get(`${API_BASE}/api/intention/day/:date`, () =>
        HttpResponse.json({
          date: DATE, creed: null,
          foci: [
            { id: 'if1', focusDate: DATE, text: 'Jelen lenni' },
            { id: 'if2', focusDate: DATE, text: 'Formára figyelni' },
          ],
          reflection: 'yes', focusCap: 3,
        }),
      ),
    )

    const { result } = renderHook(() => useDayRecap(DATE), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.events.some((e) => e.icon === '🏋️')).toBe(true))
    const icons = result.current.events.map((e) => e.icon)
    // training -> fuel -> biometrics (weight, sleep) -> journal -> foci
    expect(icons).toEqual(['🏋️', '🍽', '⚖️', '😴', '✍️', '✍️', '✦', '✦'])

    const training = result.current.events[0]
    expect(training).toEqual({ icon: '🏋️', label: 'Pull Day', meta: '✓', done: true })

    const fuelEvent = result.current.events[1]
    expect(fuelEvent).toEqual({ icon: '🍽', label: '1 étkezés', meta: '42 g fehérje', done: true })

    const weightEvent = result.current.events[2]
    expect(weightEvent).toEqual({ icon: '⚖️', label: 'Súlymérés', meta: '79.4 kg', done: true })

    const journalEvents = result.current.events.filter((e) => e.icon === '✍️')
    expect(journalEvents[0].label.length).toBeLessThanOrEqual(41) // 40 chars + ellipsis
    expect(journalEvents[0].meta).toBe('+18 XP')
    expect(journalEvents[1].label).toBe('Rövid jegyzet')
    expect(journalEvents[1].meta).toBe('')
    expect(journalEvents[1].done).toBe(true)

    const fociEvents = result.current.events.filter((e) => e.icon === '✦')
    expect(fociEvents).toEqual([
      { icon: '✦', label: 'Jelen lenni', meta: '✓', done: true },
      { icon: '✦', label: 'Formára figyelni', meta: '✓', done: true },
    ])

    expect(result.current.checkinsDone).toBe(3)
    expect(result.current.thinDay).toBe(false)
    // No heartbeat fixture override -> the default 404 -> null.
    expect(result.current.closingNote).toBeNull()
  })

  test('training event reports done:false when the day has no completedTodayWorkout yet', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    // Default /api/train/workouts/today fixture has a plan (title 'Pull Day') but no completedWorkout.
    const { result } = renderHook(() => useDayRecap(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.events.some((e) => e.icon === '🏋️')).toBe(true))
    const training = result.current.events.find((e) => e.icon === '🏋️')
    expect(training).toEqual({ icon: '🏋️', label: 'Pull Day', meta: '✓', done: false })
  })

  test('closingNote is non-null ONLY when the companion note kind is "closing"', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/proactive/heartbeat`, () =>
        HttpResponse.json({ window: 'evening', kind: 'closing', content: 'Szép napod volt, pihenj jól.' })),
    )
    const { result } = renderHook(() => useDayRecap(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.closingNote).toBe('Szép napod volt, pihenj jól.'))
  })

  test('closingNote stays null for a "nudge" kind note', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/proactive/heartbeat`, () =>
        HttpResponse.json({ window: 'midday', kind: 'nudge', content: 'Igyál vizet.' })),
    )
    const { result } = renderHook(() => useDayRecap(DATE), { wrapper: makeHookWrapper() })
    // Give the heartbeat query a chance to resolve before asserting the negative.
    await waitFor(() => expect(result.current.events.length).toBeGreaterThan(0))
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.closingNote).toBeNull()
  })

  test('thinDay flips true on an empty day (no completions, < 2 check-ins)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/train/workouts/today`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/checkin`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/sleep`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/activity/day/:date`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/fuel/day/:date`, ({ params }) =>
        HttpResponse.json({ date: String(params.date), targets: { kcal: 0, p: 0, c: 0, f: 0, water: 0 }, consumed: { kcal: 0, p: 0, c: 0, f: 0, water: 0 }, meals: [] }),
      ),
      http.get(`${API_BASE}/api/intention/day/:date`, ({ params }) =>
        HttpResponse.json({ date: params.date, creed: null, foci: [], reflection: null, focusCap: 3 }),
      ),
    )
    const { result } = renderHook(() => useDayRecap(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.events.some((e) => e.icon === '🍽')).toBe(true))
    expect(result.current.events.every((e) => !e.done)).toBe(true)
    expect(result.current.checkinsDone).toBe(0)
    expect(result.current.thinDay).toBe(true)
  })
})

describe('useDayRecap (mock mode)', () => {
  test('composes the Phase-1 statics honestly (training done:false — mock has no completion signal)', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    // Mock-mode reads ignore the `date` argument's content for everything except the one
    // weightLog entry we deliberately match against (the seed's last logged date).
    const { result } = renderHook(() => useDayRecap('2026-05-22'), { wrapper: makeHookWrapper() })

    const training = result.current.events.find((e) => e.icon === '🏋️')
    expect(training).toEqual({ icon: '🏋️', label: 'Pull Day', meta: '✓', done: false })

    const fuelEvent = result.current.events.find((e) => e.icon === '🍽')
    expect(fuelEvent).toEqual({ icon: '🍽', label: '4 étkezés', meta: '142 g fehérje', done: true })

    const weightEvent = result.current.events.find((e) => e.icon === '⚖️')
    expect(weightEvent).toEqual({ icon: '⚖️', label: 'Súlymérés', meta: '78.6 kg', done: true })

    const sleepEvent = result.current.events.find((e) => e.icon === '😴')
    expect(sleepEvent).toEqual({ icon: '😴', label: 'Alvás', meta: '7.4 óra', done: true })

    expect(result.current.events.filter((e) => e.icon === '✍️')).toHaveLength(3) // mockActivities.length
    const fociEvents = result.current.events.filter((e) => e.icon === '✦')
    expect(fociEvents).toHaveLength(2) // mockIntentionDay
    expect(fociEvents.every((e) => e.done === false)).toBe(true) // reflection is null in the seed

    expect(result.current.checkinsDone).toBe(2) // initialCheckins: 2 'done'
    expect(result.current.closingNote).toBeNull() // useCompanionNote is always null in mock mode
  })
})
