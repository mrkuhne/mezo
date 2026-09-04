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

    await waitFor(() => expect(result.current.events.some((e) => e.icon === 'i-edzes')).toBe(true))
    const icons = result.current.events.map((e) => e.icon)
    // training -> fuel -> biometrics (weight, sleep) -> journal -> foci
    expect(icons).toEqual(['i-edzes', 'i-fuel', 'i-suly', 'i-alvas', 'i-naplo', 'i-naplo', 'i-cel', 'i-cel'])

    const training = result.current.events[0]
    expect(training).toEqual({ icon: 'i-edzes', label: 'Pull Day', meta: '✓', done: true })

    const fuelEvent = result.current.events[1]
    expect(fuelEvent).toEqual({ icon: 'i-fuel', label: '1 étkezés', meta: '42 g fehérje', done: true })

    const weightEvent = result.current.events[2]
    expect(weightEvent).toEqual({ icon: 'i-suly', label: 'Súlymérés', meta: '79.4 kg', done: true })

    const journalEvents = result.current.events.filter((e) => e.icon === 'i-naplo')
    expect(journalEvents[0].label.length).toBeLessThanOrEqual(41) // 40 chars + ellipsis
    expect(journalEvents[0].meta).toBe('+18 XP')
    expect(journalEvents[1].label).toBe('Rövid jegyzet')
    expect(journalEvents[1].meta).toBe('')
    expect(journalEvents[1].done).toBe(true)

    const fociEvents = result.current.events.filter((e) => e.icon === 'i-cel')
    expect(fociEvents).toEqual([
      { icon: 'i-cel', label: 'Jelen lenni', meta: '✓', done: true },
      { icon: 'i-cel', label: 'Formára figyelni', meta: '✓', done: true },
    ])

    expect(result.current.checkinsDone).toBe(3)
    expect(result.current.thinDay).toBe(false)
    // No feed fixture override -> the default empty array -> no evening message -> null.
    expect(result.current.closingNote).toBeNull()
  })

  test('training event reports done:false when the day has no completedTodayWorkout yet', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    // Default /api/train/workouts/today fixture has a plan (title 'Pull Day') but no completedWorkout.
    const { result } = renderHook(() => useDayRecap(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.events.some((e) => e.icon === 'i-edzes')).toBe(true))
    const training = result.current.events.find((e) => e.icon === 'i-edzes')
    expect(training).toEqual({ icon: 'i-edzes', label: 'Pull Day', meta: '✓', done: false })
  })

  test('closingNote is non-null ONLY when the feed carries an "evening" kind message', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/proactive/feed`, () =>
        HttpResponse.json([{
          date: DATE, kind: 'evening', eyebrow: 'Napzárás',
          body: ['Szép napod volt, pihenj jól.'], refs: [], generatedAt: `${DATE}T20:30:00Z`,
        }])),
    )
    const { result } = renderHook(() => useDayRecap(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.closingNote).toBe('Szép napod volt, pihenj jól.'))
  })

  test('closingNote stays null for a "midday" kind message', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/proactive/feed`, () =>
        HttpResponse.json([{
          date: DATE, kind: 'midday', eyebrow: 'Napközi jegyzet',
          body: ['Igyál vizet.'], refs: [], generatedAt: `${DATE}T12:30:00Z`,
        }])),
    )
    const { result } = renderHook(() => useDayRecap(DATE), { wrapper: makeHookWrapper() })
    // Give the feed query a chance to resolve before asserting the negative.
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
    await waitFor(() => expect(result.current.events.some((e) => e.icon === 'i-fuel')).toBe(true))
    expect(result.current.events.every((e) => !e.done)).toBe(true)
    expect(result.current.checkinsDone).toBe(0)
    expect(result.current.thinDay).toBe(true)
  })

  // mezo-cq06 — a skip_sport_slot advice action hides one dated occurrence of a recurring sport
  // slot; the rest-day fallback (`train.sport.schedule.volleyball.sessions.find(s => s.today)`)
  // used to keep reporting it regardless, contradicting the backend's own
  // `hasScheduledTrainingOn`. Pin a Tuesday (fake `Date` only — trainHooks.ts derives the
  // schedule's `today` flag from `new Date()`) so the fixture's Kedd slot deterministically
  // matches "today", instead of depending on the weekday the suite happens to run.
  describe('rest-day sport fallback honours a sport-slot skip', () => {
    const REST_DAY = '2026-06-16' // Tuesday — dayOfWeek 1
    const sportScheduleFixture = () =>
      http.get(`${API_BASE}/api/train/sport-schedule`, () =>
        HttpResponse.json([
          { id: 'e1', dayOfWeek: 1, time: '17:00', durationMin: 90, kind: 'training', location: 'BVSC', intensityLabel: 'közepes' },
        ]),
      )
    const restDay = () => http.get(`${API_BASE}/api/train/workouts/today`, () => new HttpResponse(null, { status: 404 }))

    afterEach(() => { vi.useRealTimers() })

    test('a skip matching the fallback slot removes the "i-sport" recap event', async () => {
      vi.stubEnv('VITE_USE_MOCK', 'false')
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(`${REST_DAY}T08:00:00`))
      server.use(
        restDay(), sportScheduleFixture(),
        http.get(`${API_BASE}/api/train/sport-slot-skips`, () =>
          HttpResponse.json([{ dayOfWeek: 1, time: '17:00', date: REST_DAY }]),
        ),
      )
      const { result } = renderHook(() => useDayRecap(REST_DAY), { wrapper: makeHookWrapper() })
      await waitFor(() => expect(result.current.events.some((e) => e.icon === 'i-fuel')).toBe(true))
      expect(result.current.events.some((e) => e.icon === 'i-sport')).toBe(false)
    })

    test('a skip for a different date leaves the "i-sport" recap event present', async () => {
      vi.stubEnv('VITE_USE_MOCK', 'false')
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(`${REST_DAY}T08:00:00`))
      server.use(
        restDay(), sportScheduleFixture(),
        http.get(`${API_BASE}/api/train/sport-slot-skips`, () =>
          HttpResponse.json([{ dayOfWeek: 1, time: '17:00', date: '2026-06-23' }]), // next Tuesday
        ),
      )
      const { result } = renderHook(() => useDayRecap(REST_DAY), { wrapper: makeHookWrapper() })
      await waitFor(() => expect(result.current.events.some((e) => e.icon === 'i-sport')).toBe(true))
      const sportEvent = result.current.events.find((e) => e.icon === 'i-sport')
      expect(sportEvent).toEqual({ icon: 'i-sport', label: 'Röplabda', meta: '17:00', done: false })
    })
  })
})

describe('useDayRecap (mock mode)', () => {
  test('composes the Phase-1 statics honestly (training done:false — mock has no completion signal)', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    // Mock-mode reads ignore the `date` argument's content for everything except the one
    // weightLog entry we deliberately match against (the seed's last logged date).
    const { result } = renderHook(() => useDayRecap('2026-05-22'), { wrapper: makeHookWrapper() })

    const training = result.current.events.find((e) => e.icon === 'i-edzes')
    expect(training).toEqual({ icon: 'i-edzes', label: 'Pull Day', meta: '✓', done: false })

    // Mock day (mezo-1oy5): breakfast + lunch + the fix-round-1 F1 (mezo-jcpt.3) coherent
    // late-miss dinner logged → 3 meals, consumed protein 148 g.
    const fuelEvent = result.current.events.find((e) => e.icon === 'i-fuel')
    expect(fuelEvent).toEqual({ icon: 'i-fuel', label: '3 étkezés', meta: '148 g fehérje', done: true })

    const weightEvent = result.current.events.find((e) => e.icon === 'i-suly')
    expect(weightEvent).toEqual({ icon: 'i-suly', label: 'Súlymérés', meta: '78.6 kg', done: true })

    // mezo-idz2 appended a date-relative today row to sleepLog (DayOrb mock parity); mock-mode
    // "last night" reads the seed's last entry regardless of the `date` argument, so it's now
    // that today row (7.1 h) instead of the former last entry (7.5 h).
    const sleepEvent = result.current.events.find((e) => e.icon === 'i-alvas')
    expect(sleepEvent).toEqual({ icon: 'i-alvas', label: 'Alvás', meta: '7.1 óra', done: true })

    expect(result.current.events.filter((e) => e.icon === 'i-naplo')).toHaveLength(3) // mockActivities.length
    const fociEvents = result.current.events.filter((e) => e.icon === 'i-cel')
    expect(fociEvents).toHaveLength(2) // mockIntentionDay
    expect(fociEvents.every((e) => e.done === false)).toBe(true) // reflection is null in the seed

    expect(result.current.checkinsDone).toBe(2) // initialCheckins: 2 'done'
    expect(result.current.closingNote).toBeNull() // useCompanionFeed is always [] in mock mode
  })
})
