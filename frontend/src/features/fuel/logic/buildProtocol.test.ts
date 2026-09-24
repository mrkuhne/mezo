import { deriveBlocks, deriveLoggedBlocks, deriveProtocolAnchors } from '@/features/fuel/logic/buildProtocol'
import { todayIdx } from '@/data/train/runningAgenda'
import { localDateString } from '@/shared/lib/dates'
import type { GymSchedule, SportSession, VolleyballSession } from '@/data/types'

// --- deriveProtocolAnchors — the CANONICAL preWorkout derivation (fix round 1, mezo-h4wp.6.3) ---
// Pinning the bug the review caught: without this, both the notification schedule writer and
// the settings preview independently re-derived `preWorkout`, so the pre-workout/pre-snack slots
// silently used a REST-DAY fallback on every training day, hours off the real gym time.
// deriveProtocolAnchors is the one place `preWorkout` is derived from the day's training blocks —
// every caller needing a `{wake, preWorkout, bedtime}` shape must go through it rather than
// re-deriving the same minute independently (mezo-vx9v Task 9: `projectStackDay` now derives the
// same offset straight from `blocks` + `PRE_WORKOUT_STACK_LEAD_MIN` for its own callers, but this
// function's contract — and the bug it pins — still hold for anyone consuming the anchors shape).
describe('deriveProtocolAnchors', () => {
  const gymToday: GymSchedule = {
    weeklyTimes: [
      { day: 'Szerda', active: true, today: true, time: '17:00', duration: 75, type: 'Láb nap' },
    ],
  }
  const noSport = { schedule: null }

  test('with a gym schedule present, preWorkout anchors to gym time minus 40 minutes — never wake + 60', () => {
    const anchors = deriveProtocolAnchors(gymToday, noSport, null, '06:30', '22:30')
    expect(anchors.preWorkout).toBe('16:20')
    expect(anchors.wake).toBe('06:30')
    expect(anchors.bedtime).toBe('22:30')
  })

  test('with no training scheduled today, preWorkout is honestly undefined — never a fabricated fallback minute', () => {
    const anchors = deriveProtocolAnchors(null, noSport, null, '07:00', '23:00')
    expect(anchors.preWorkout).toBeUndefined()
    expect(anchors.wake).toBe('07:00')
    expect(anchors.bedtime).toBe('23:00')
  })
})

// --- deriveBlocks — sport-slot skip (mezo-cq06) ---
// The fuel protocol used to keep anchoring the pre-workout meal / calorie budget on today's
// sport block even after a skip_sport_slot advice action hid that exact dated occurrence — the
// one FE read that visibly contradicted the backend's `WorkoutWindowQueryService.windowsFor` (skip-aware schedule read).
describe('deriveBlocks — sport-slot skip', () => {
  const sport = (overrides: Partial<VolleyballSession> = {}): VolleyballSession => ({
    day: 'Kedd', time: '18:00', duration: 90, court: 'BVSC', intensity: 'közepes', role: 'edzés',
    today: true,
    ...overrides,
  })

  test('a skip matching today\'s weekday + time + date removes the sport block', () => {
    const todayIso = localDateString(new Date())
    const skips = [{ dayOfWeek: todayIdx(), time: '18:00', date: todayIso }]
    const blocks = deriveBlocks(null, { schedule: { volleyball: { team: '', sessions: [sport()], season: '', weeklyHours: 0 } } }, null, skips)
    expect(blocks.find((b) => b.kind === 'sport')).toBeUndefined()
  })

  test('a skip for a different date leaves today\'s sport block present', () => {
    const skips = [{ dayOfWeek: todayIdx(), time: '18:00', date: '1999-01-01' }]
    const blocks = deriveBlocks(null, { schedule: { volleyball: { team: '', sessions: [sport()], season: '', weeklyHours: 0 } } }, null, skips)
    expect(blocks.find((b) => b.kind === 'sport')?.time).toBe('18:00')
  })

  test('no skips leaves today\'s sport block present (default param, byte-identical to pre-mezo-cq06 callers)', () => {
    const blocks = deriveBlocks(null, { schedule: { volleyball: { team: '', sessions: [sport()], season: '', weeklyHours: 0 } } }, null)
    expect(blocks.find((b) => b.kind === 'sport')?.time).toBe('18:00')
  })
})

// --- deriveBlocks — ad-hoc logged sport session (mezo-rilew) ---
// Owner report: an unplanned volleyball session was logged and the Fuel day's calorie target did
// not move. The day's activity energy (`eat`) is summed over these blocks, and the block list was
// SCHEDULE-only — a session the user actually played but never planned burned kcal that no surface
// ever added back. A session that DOES consume a planned occurrence must not be counted twice.
describe('deriveBlocks — ad-hoc logged sport session', () => {
  const todayIso = localDateString(new Date())
  const session = (overrides: Partial<SportSession> = {}): SportSession => ({
    id: 's1', sport: 'volleyball', date: 'szept. 18.', isoDate: todayIso, time: '18:00', duration: 90,
    setsPlayed: null, rounds: null, intensity: null, rpe: 7, shoulderStrain: null,
    jumpCount: null, notes: null, kcal: 700, kcalIsEstimate: true,
    ...overrides,
  })
  const planned = (overrides: Partial<VolleyballSession> = {}): VolleyballSession => ({
    day: 'Kedd', time: '18:00', duration: 90, court: 'BVSC', intensity: 'közepes', role: 'edzés',
    today: true,
    ...overrides,
  })
  const withSessions = (plan: VolleyballSession[], sessions: SportSession[]) =>
    deriveBlocks(
      null,
      { schedule: plan.length ? { volleyball: { team: '', sessions: plan, season: '', weeklyHours: 0 } } : null },
      null,
      [],
      sessions,
    )

  test('a logged session with no plan behind it becomes a sport block at its own time and duration', () => {
    const blocks = withSessions([], [session()])
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ kind: 'sport', time: '18:00', durationMin: 90, label: 'Volleyball' })
  })

  test('a logged session that consumes today\'s planned occurrence yields ONE block, not two', () => {
    const blocks = withSessions([planned()], [session()])
    expect(blocks.filter((b) => b.kind === 'sport')).toHaveLength(1)
  })

  test('the logged session\'s OWN time and duration win over the plan it consumed', () => {
    const blocks = withSessions([planned()], [session({ time: '19:30', duration: 120 })])
    expect(blocks.filter((b) => b.kind === 'sport')).toEqual([
      { kind: 'sport', time: '19:30', durationMin: 120, label: 'Volleyball' },
    ])
  })

  test('a planned occurrence nobody logged still carries the day (nothing is dropped)', () => {
    const blocks = withSessions([planned({ time: '20:00' })], [])
    expect(blocks.filter((b) => b.kind === 'sport')).toHaveLength(1)
  })

  test('a session logged on another date never lands on today', () => {
    const blocks = withSessions([], [session({ isoDate: '1999-01-01' })])
    expect(blocks).toHaveLength(0)
  })

  test('two logged sessions against one plan yield two blocks — the unplanned one is never swallowed', () => {
    const blocks = withSessions([planned()], [session(), session({ id: 's2', time: '07:00', duration: 60 })])
    expect(blocks.filter((b) => b.kind === 'sport').map((b) => b.time).sort()).toEqual(['07:00', '18:00'])
  })

  test('no sessions passed keeps every caller byte-identical (default param)', () => {
    const blocks = deriveBlocks(null, { schedule: { volleyball: { team: '', sessions: [planned()], season: '', weeklyHours: 0 } } }, null)
    expect(blocks.filter((b) => b.kind === 'sport')).toHaveLength(1)
  })
})

// --- deriveLoggedBlocks — only LOGGED movement raises the calorie target (mezo-u13jv) ---
// Owner decision 2026-09-24: a planned session not yet done must not raise the day's calorie
// target; only movement that was actually logged does.
describe('deriveLoggedBlocks', () => {
  const today = '2026-07-02'
  const plannedGym = { kind: 'gym' as const, time: '17:00', durationMin: 75, label: 'Láb nap' }
  const plannedRun = { kind: 'run' as const, time: '07:00', durationMin: null, label: 'Sprint' }
  const session = (isoDate: string): SportSession => ({
    id: 's1', sport: 'volleyball', date: '', isoDate, time: '18:00', duration: 90,
    setsPlayed: null, rounds: null, intensity: null, rpe: 7, shoulderStrain: null,
    jumpCount: null, notes: null, kcal: null, kcalIsEstimate: null,
  })
  const none = { gymDone: false, sportSessions: [], runLogs: [], todayIso: today }

  test('a planned-but-not-done day yields NO logged blocks', () => {
    expect(deriveLoggedBlocks({ ...none, planned: [plannedGym, plannedRun] })).toEqual([])
  })

  test('a completed gym workout yields the planned gym block', () => {
    expect(deriveLoggedBlocks({ ...none, planned: [plannedGym], gymDone: true })).toEqual([plannedGym])
  })

  test('an unplanned completed gym workout is timed and sized from the workout itself', () => {
    const blocks = deriveLoggedBlocks({
      ...none, planned: [], gymDone: true,
      completedGym: { startedAt: '2026-07-02T09:00:00', finishedAt: '2026-07-02T10:10:00', title: 'Saját' },
    })
    expect(blocks).toEqual([{ kind: 'gym', time: '09:00', durationMin: 70, label: 'Saját' }])
  })

  test('only today\'s sport sessions and runs count', () => {
    const blocks = deriveLoggedBlocks({
      ...none, planned: [plannedRun],
      sportSessions: [session(today), session('2026-06-30')],
      runLogs: [{ date: today, durationMin: 30 }, { date: '2026-06-30', durationMin: 40 }],
    })
    expect(blocks.map(b => [b.kind, b.durationMin])).toEqual([['sport', 90], ['run', 30]])
    expect(blocks[1].time).toBe('07:00') // the run borrows the planned run's time
  })
})
