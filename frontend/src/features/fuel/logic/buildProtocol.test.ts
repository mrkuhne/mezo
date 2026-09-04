import { deriveBlocks, deriveProtocolAnchors } from '@/features/fuel/logic/buildProtocol'
import { todayIdx } from '@/data/train/runningAgenda'
import { localDateString } from '@/shared/lib/dates'
import type { GymSchedule, VolleyballSession } from '@/data/types'

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
// one FE read that visibly contradicted the backend's `hasScheduledTrainingOn`.
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
