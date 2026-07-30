import { buildDayZones, isMealSlot, slotRole } from '@/features/fuel/logic/dayZones'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { FuelSlot } from '@/data/types'

const WAKE = '06:45'
const BED = '23:00'

const meal = (time: string, over: Partial<FuelSlot> = {}): FuelSlot => ({
  time, kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'pending', kcal: 600, p: 40, c: 60, f: 20, ...over,
})
const supplement = (time: string, done = false): FuelSlot => ({
  time, kind: 'snack', label: 'Pre-workout snack', state: done ? 'done' : 'pending',
  items: [{ type: 'supplement', refId: 'a', label: 'Koffein · 200mg', done }],
})
const workout = (time: string): FuelSlot => ({ time, kind: 'workout', label: 'Pull Day', state: 'pending', duration: 90 })

const zones = (slots: FuelSlot[], blocks: PlannerBlock[] = [], weightKg = 82) =>
  buildDayZones({ slots, wake: WAKE, bed: BED, blocks, weightKg })

test('slotRole classifies by item-presence first, then kind', () => {
  // A protocol slot can carry kind 'snack' (PROTOCOL_KIND['pre-fuel']) — items must win,
  // otherwise a supplement window would be counted as an eating window.
  expect(slotRole(supplement('16:00'))).toBe('supplement')
  expect(slotRole(workout('17:00'))).toBe('activity')
  expect(slotRole(meal('13:00'))).toBe('meal')
  expect(slotRole({ time: '07:00', kind: 'wake', label: 'Ébresztő', state: 'done' })).toBe('other')
  expect(isMealSlot(meal('13:00'))).toBe(true)
  expect(isMealSlot(supplement('16:00'))).toBe(false)
})

test('buckets slots into the four wake→bed zones', () => {
  const result = zones([meal('09:15'), meal('13:00'), meal('17:00'), meal('19:30')])
  expect(result.map(z => z.key)).toEqual(['morning', 'midday', 'afternoon', 'evening'])
  expect(result.map(z => z.label)).toEqual(['Reggel', 'Dél', 'Délután', 'Este'])
})

test('omits zones with no slots — a 3-meal day produces no empty chrome', () => {
  const result = zones([meal('09:15'), meal('13:00')])
  expect(result.map(z => z.key)).toEqual(['morning', 'midday'])
})

test('kcal sums only eating windows, never supplement slots of kind snack', () => {
  const result = zones([meal('12:30', { kcal: 700 }), supplement('13:30')])
  expect(result).toHaveLength(1)
  expect(result[0].kcal).toBe(700)
  expect(result[0].hasMeals).toBe(true)
})

test('zone state: done when every eating window is logged', () => {
  const result = zones([meal('09:00', { state: 'done' }), meal('10:30', { state: 'done' })])
  expect(result[0].state).toBe('done')
})

test('zone state: open when the zone holds the now window', () => {
  const result = zones([meal('09:00', { state: 'done' }), meal('11:00', { state: 'now' })])
  expect(result[0].state).toBe('open')
})

test('zone state: ahead otherwise', () => {
  expect(zones([meal('19:30')])[0].state).toBe('ahead')
})

test('burnKcal reuses blockKcal, matched to its block by exact time', () => {
  // MET gym 6.0 × 82 kg × 1.5 h = 738
  const result = zones([workout('17:00')], [{ kind: 'gym', time: '17:00', durationMin: 90, label: 'Pull Day' }])
  expect(result[0].burnKcal).toBe(738)
  expect(result[0].hasMeals).toBe(false)
})

test('an activity slot with no matching block contributes no burn', () => {
  expect(zones([workout('17:00')], [])[0].burnKcal).toBe(0)
})

test('stackPips carry one entry per supplement item, true when taken', () => {
  const result = zones([supplement('16:00', true), supplement('21:30', false)])
  expect(result.flatMap(z => z.stackPips)).toEqual([true, false])
})

test('a pre-wake slot clamps into the first zone instead of being dropped', () => {
  const result = zones([meal('05:30', { state: 'done' })])
  expect(result).toHaveLength(1)
  expect(result[0].key).toBe('morning')
})

test('with a past-midnight bedtime a 00:30 slot lands in the evening zone', () => {
  const result = buildDayZones({
    slots: [meal('09:00'), meal('00:30')], wake: '06:45', bed: '01:00', blocks: [], weightKg: 80,
  })
  expect(result.map(z => z.key)).toEqual(['morning', 'evening'])
})

// ── bedMin===1440 regression (mezo-rrtj fix wave item 8) ──────────────────────
// bed === '00:00' unwraps to EXACTLY 1440 (toMin('00:00') is 0) — a stale `bedMin > 1440`
// midnight-crossing check misses this exact value, so a 00:15 slot used to clamp into the
// morning zone instead of unwrapping into the evening one. Detect the crossing off
// `toMin(bed) <= toMin(wake)` (daySpan/unwrapDayMinute) instead of re-deriving from bedMin.
test('a midnight-EXACT bedtime (00:00) still unwraps a 00:15 slot into the evening zone', () => {
  const result = buildDayZones({
    slots: [meal('09:00'), meal('00:15')], wake: '06:45', bed: '00:00', blocks: [], weightKg: 80,
  })
  expect(result.map(z => z.key)).toEqual(['morning', 'evening'])
})
