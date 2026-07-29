import { buildProtocol, deriveProtocolAnchors } from '@/features/fuel/logic/buildProtocol'
import { supplementsStash } from '@/data/fuel/fuel'
import type { GymSchedule, SupplementStashItem } from '@/data/types'

test('builds a timed protocol from selected stash items', () => {
  const selected = supplementsStash.filter(s => s.type !== 'medication').map(s => s.id)
  const result = buildProtocol(selected, supplementsStash)
  expect(result.slots.length).toBeGreaterThan(0)
  expect(result.reasoning.length).toBeGreaterThan(0)
  expect(result.mealMatches.length).toBeGreaterThan(0)
})
test('empty selection yields empty slots', () => {
  expect(buildProtocol([], supplementsStash).slots).toHaveLength(0)
})

// --- Real-stash matching (UUID ids + catalog names, no mock slugs) ---
// In real mode the pantry stash carries backend UUID ids and the 147-item
// catalog's real Hungarian names, so slug-id rules (byId('kreatin')) all miss.
// buildProtocol must match on name/id substrings instead.
function mk(id: string, name: string): SupplementStashItem {
  return {
    id,
    name,
    brand: 'Test',
    type: 'supplement',
    category: 'test',
    dose: '1 adag',
    form: 'kapszula',
    stock: 10,
    stockUnit: 'db',
    protocol: 'test',
    timing: 'flexible',
    taken: false,
  }
}

const realStash: SupplementStashItem[] = [
  mk('11111111-1111-4111-8111-111111111111', 'Kreatin monohidrát'),
  mk('22222222-2222-4222-8222-222222222222', 'Koffein 200'),
  mk('33333333-3333-4333-8333-333333333333', 'D3 + K2 vitamin'),
  mk('44444444-4444-4444-8444-444444444444', 'Magnézium-biszglicinát'),
  mk('55555555-5555-4555-8555-555555555555', 'Omega-3'),
  mk('66666666-6666-4666-8666-666666666666', 'AAKG L-Arginine'),
  mk('77777777-7777-4777-8777-777777777777', 'Béta-alanin'),
  mk('88888888-8888-4888-8888-888888888888', 'Impact Whey Protein'),
]

test('real stash (UUID ids + catalog names) produces the same slot kinds as the slug stash', () => {
  const slugSel = supplementsStash.filter(s => s.type !== 'medication').map(s => s.id)
  const slugKinds = buildProtocol(slugSel, supplementsStash).slots.map(s => s.kind).sort()

  const realSel = realStash.map(s => s.id)
  const realKinds = buildProtocol(realSel, realStash).slots.map(s => s.kind).sort()

  expect(realKinds.length).toBeGreaterThan(0)
  expect(realKinds).toEqual(slugKinds)
})

test('every emitted protocol item carries its source stash refId', () => {
  const realSel = realStash.map(s => s.id)
  const built = buildProtocol(realSel, realStash)
  const validIds = new Set(realStash.map(s => s.id))
  const allItems = built.slots.flatMap(s => s.items)

  expect(allItems.length).toBeGreaterThan(0)
  for (const item of allItems) {
    expect(item.refId).toBeDefined()
    expect(validIds.has(item.refId)).toBe(true)
  }
})

// --- Anchor-aware slot times (Fuel P5) ---
// When the caller passes the user's real day anchors, slot TIMES derive from
// them instead of the hardcoded mock times. String prose is untouched (P8).
const byKind = (built: ReturnType<typeof buildProtocol>, kind: string) =>
  built.slots.find(s => s.kind === kind)

test('anchored: slot times derive from wake / preWorkout / bedtime anchors', () => {
  const sel = realStash.map(s => s.id)
  const built = buildProtocol(sel, realStash, { wake: '06:30', preWorkout: '17:15', bedtime: '22:30' })
  expect(byKind(built, 'morning')?.time).toBe('06:30')
  expect(byKind(built, 'pre-fuel')?.time).toBe('16:45') // pre-workout − 30
  expect(byKind(built, 'pre-workout')?.time).toBe('17:15')
  expect(byKind(built, 'evening')?.time).toBe('20:30') // bedtime − 120
  expect(byKind(built, 'fat-bound')?.time).toBe('12:30') // midday unchanged
})

test('anchored without preWorkout (rest day): pre-workout slot stays relative to wake', () => {
  const sel = realStash.map(s => s.id)
  const built = buildProtocol(sel, realStash, { wake: '07:00', bedtime: '23:00' })
  expect(byKind(built, 'pre-workout')?.time).toBe('08:00') // wake + 60
  expect(byKind(built, 'pre-fuel')?.time).toBe('07:30') // pre-workout − 30
  expect(byKind(built, 'morning')?.time).toBe('07:00')
  expect(byKind(built, 'evening')?.time).toBe('21:00') // bedtime − 120
})

test('no anchors: every hardcoded mock time is preserved', () => {
  const sel = realStash.map(s => s.id)
  const built = buildProtocol(sel, realStash)
  expect(byKind(built, 'morning')?.time).toBe('05:50')
  expect(byKind(built, 'pre-fuel')?.time).toBe('06:20')
  expect(byKind(built, 'pre-workout')?.time).toBe('06:50')
  expect(byKind(built, 'fat-bound')?.time).toBe('12:30')
  expect(byKind(built, 'evening')?.time).toBe('21:00')
})

// --- deriveProtocolAnchors — the CANONICAL preWorkout derivation (fix round 1, mezo-h4wp.6.3) ---
// Pinning the bug the review caught: without this, both the notification schedule writer and
// the settings preview called buildProtocol with only {wake, bedtime}, so the pre-workout/
// pre-snack slots silently used the wake+60 REST-DAY fallback on every training day, hours off
// the real gym time. deriveProtocolAnchors is the one place `preWorkout` is derived from the
// day's training blocks — useFuelTimeline, the notification writer, and the settings preview
// must all go through it rather than re-deriving the same minute independently.
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

  test('feeding the derived anchors into buildProtocol lands the pre-workout slot at the gym-anchored time', () => {
    const sel = realStash.map(s => s.id)
    const anchors = deriveProtocolAnchors(gymToday, noSport, null, '06:30', '22:30')
    const built = buildProtocol(sel, realStash, anchors)
    expect(byKind(built, 'pre-workout')?.time).toBe('16:20')
    // The bug this pins: without a derived preWorkout, buildProtocol's rest-day fallback
    // (wake + 60) would have put this slot at 07:30 — hours away from the real 17:00 gym time.
    expect(byKind(built, 'pre-workout')?.time).not.toBe('07:30')
  })

  test('with no training scheduled today, preWorkout is undefined — buildProtocol applies its own documented rest-day fallback', () => {
    const anchors = deriveProtocolAnchors(null, noSport, null, '07:00', '23:00')
    expect(anchors.preWorkout).toBeUndefined()
    const sel = realStash.map(s => s.id)
    const built = buildProtocol(sel, realStash, anchors)
    expect(byKind(built, 'pre-workout')?.time).toBe('08:00') // wake + 60 — buildProtocol's own, intentional fallback
  })
})
