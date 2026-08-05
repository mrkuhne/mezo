import { validateSlotPlan } from '@/features/fuel/logic/validateSlotPlan'
import type { PlannedWindow } from '@/features/fuel/logic/buildDayPlan'
import type { SlotAnchor, SlotTemplateDayType, SlotTemplateRow } from '@/data/types'

// wake 06:00 (360) / bed 22:00 (1320) — span 960, last third starts at 1000 (16:40),
// kitchenClose = bed-90 = 1230 (20:30). Chosen so 90-min-apart fixed anchors never collide.
const WAKE = '06:00'
const BED = '22:00'
const baseCtx: { wake: string; bed: string; dayType: SlotTemplateDayType; budgetKcal: number } =
  { wake: WAKE, bed: BED, dayType: 'rest', budgetKcal: 2000 }

const row = (over: Partial<SlotTemplateRow> & { anchor: SlotAnchor; budgetPct: number }): SlotTemplateRow => ({
  label: 'Reggeli', slotKind: 'breakfast', role: 'standard', ...over,
})
const win = (time: number, over: Partial<PlannedWindow> & { budgetPct: number }): PlannedWindow => ({
  slotKey: 'breakfast', kind: 'meal', label: 'Reggeli', time, weight: over.budgetPct, ...over,
})
const fixed = (hhmm: string): SlotAnchor => ({ type: 'fixed', time: hhmm })

// A baseline plan with no error/warning triggers: Reggeli 07:00 (30%), Ebéd 13:00 (40%),
// Vacsora 19:00 (30%) — Σ=100, all inside the eating span, ≥90 min apart, nothing in the
// evening third alone over 40%, nothing past kitchen close.
const validRows: SlotTemplateRow[] = [
  row({ label: 'Reggeli', anchor: fixed('07:00'), budgetPct: 30 }),
  row({ label: 'Ebéd', anchor: fixed('13:00'), budgetPct: 40 }),
  row({ label: 'Vacsora', anchor: fixed('19:00'), budgetPct: 30 }),
]
const validCompiled: PlannedWindow[] = [
  win(420, { label: 'Reggeli', budgetPct: 30 }),
  win(780, { label: 'Ebéd', budgetPct: 40 }),
  win(1140, { label: 'Vacsora', budgetPct: 30 }),
]

test('a fully valid plan produces no errors and no warnings', () => {
  const { errors, warnings } = validateSlotPlan(validRows, validCompiled, baseCtx)
  expect(errors).toEqual([])
  expect(warnings).toEqual([])
})

test('sum_pct: budgetPct summing to 80% (outside 100±1) is an error naming the actual sum', () => {
  const rows = [
    row({ label: 'Reggeli', anchor: fixed('07:00'), budgetPct: 40 }),
    row({ label: 'Ebéd', anchor: fixed('13:00'), budgetPct: 40 }),
  ]
  const compiled = [win(420, { label: 'Reggeli', budgetPct: 40 }), win(780, { label: 'Ebéd', budgetPct: 40 })]
  const { errors, warnings } = validateSlotPlan(rows, compiled, baseCtx)
  expect(errors).toEqual([{ code: 'sum_pct', text: '„A budgetek összege 80% — 100% kell legyen"' }])
  expect(warnings).toEqual([])
})

test('too_few: a single slot is an error', () => {
  const rows = [row({ label: 'Reggeli', anchor: fixed('07:00'), budgetPct: 100 })]
  const compiled = [win(420, { label: 'Reggeli', budgetPct: 100 })]
  const { errors, warnings } = validateSlotPlan(rows, compiled, baseCtx)
  expect(errors.map(e => e.code)).toEqual(['too_few'])
  expect(warnings).toEqual([])
})

test('too_many: more than MAX_TEMPLATE_SLOTS (8) rows is an error', () => {
  const times = ['07:00', '08:30', '10:00', '11:30', '13:00', '14:30', '16:00', '17:30', '19:00']
  const pcts = [11, 11, 11, 11, 11, 11, 11, 11, 12] // Σ=100
  const rows = times.map((t, i) => row({ label: `Slot${i}`, anchor: fixed(t), budgetPct: pcts[i] }))
  const compiled = [420, 510, 600, 690, 780, 870, 960, 1050, 1140].map((t, i) =>
    win(t, { label: `Slot${i}`, budgetPct: pcts[i] }),
  )
  const { errors, warnings } = validateSlotPlan(rows, compiled, baseCtx)
  expect(errors.map(e => e.code)).toEqual(['too_many'])
  expect(warnings).toEqual([])
})

test('out_of_span: a compiled window resolving before wake is an error', () => {
  const compiled = [
    win(300, { label: 'Reggeli', budgetPct: 30 }), // 05:00 — before wake (06:00/360)
    win(780, { label: 'Ebéd', budgetPct: 40 }),
    win(1140, { label: 'Vacsora', budgetPct: 30 }),
  ]
  const { errors, warnings } = validateSlotPlan(validRows, compiled, baseCtx)
  expect(errors.map(e => e.code)).toEqual(['out_of_span'])
  expect(warnings).toEqual([])
})

test('rest_training_anchor: a training-anchored row on a rest-day template is an error', () => {
  const rows = [
    row({ label: 'Reggeli', anchor: fixed('07:00'), budgetPct: 50 }),
    row({ label: 'Pre', anchor: { type: 'training_start', offsetMin: -30 }, budgetPct: 50 }),
  ]
  // compileTemplate would defensively drop the training-anchored row on a blockless rest day.
  const compiled = [win(420, { label: 'Reggeli', budgetPct: 50 })]
  const { errors, warnings } = validateSlotPlan(rows, compiled, { ...baseCtx, dayType: 'rest' })
  expect(errors.map(e => e.code)).toEqual(['rest_training_anchor'])
  expect(warnings).toEqual([])
})

test('gap: two compiled windows closer than MIN_SLOT_GAP_MIN (90) is a warning naming both labels', () => {
  const rows = [
    row({ label: 'A', anchor: fixed('07:00'), budgetPct: 50 }),
    row({ label: 'B', anchor: fixed('07:30'), budgetPct: 50 }),
  ]
  const compiled = [win(420, { label: 'A', budgetPct: 50 }), win(450, { label: 'B', budgetPct: 50 })]
  const { errors, warnings } = validateSlotPlan(rows, compiled, baseCtx)
  expect(errors).toEqual([])
  expect(warnings).toEqual([{ code: 'gap', text: '„A" és „B" között 90 percnél kisebb a rés.' }])
})

test('pre_workout_big: a pre_workout slot over 15% (and over 300 kcal) is a warning', () => {
  const rows = [
    row({ label: 'Pre', role: 'pre_workout', anchor: fixed('07:00'), budgetPct: 20 }),
    row({ label: 'Main', anchor: fixed('13:00'), budgetPct: 80 }),
  ]
  const compiled = [
    win(420, { label: 'Pre', budgetPct: 20, role: 'pre_workout' }),
    win(780, { label: 'Main', budgetPct: 80 }),
  ]
  const { errors, warnings } = validateSlotPlan(rows, compiled, baseCtx)
  expect(errors).toEqual([])
  expect(warnings.map(w => w.code)).toEqual(['pre_workout_big'])
})

test('evening_heavy: windows in the last third of the day summing over 40% is a warning', () => {
  const rows = [
    row({ label: 'A', anchor: fixed('07:00'), budgetPct: 30 }),
    row({ label: 'B', anchor: fixed('17:00'), budgetPct: 35 }),
    row({ label: 'C', anchor: fixed('19:00'), budgetPct: 35 }),
  ]
  const compiled = [
    win(420, { label: 'A', budgetPct: 30 }),
    win(1020, { label: 'B', budgetPct: 35 }), // 17:00, inside the last third (>=1000)
    win(1140, { label: 'C', budgetPct: 35 }), // 19:00, inside the last third
  ]
  const { errors, warnings } = validateSlotPlan(rows, compiled, baseCtx)
  expect(errors).toEqual([])
  expect(warnings.map(w => w.code)).toEqual(['evening_heavy'])
})

test('past_kitchen_close: a compiled window at/after bed-KITCHEN_CLOSE_OFFSET_MIN is a warning', () => {
  const rows = [
    row({ label: 'A', anchor: fixed('07:00'), budgetPct: 70 }),
    row({ label: 'B', anchor: fixed('20:45'), budgetPct: 30 }),
  ]
  const compiled = [
    win(420, { label: 'A', budgetPct: 70 }),
    win(1245, { label: 'B', budgetPct: 30 }), // 20:45 >= kitchenClose (22:00-90=1230)
  ]
  const { errors, warnings } = validateSlotPlan(rows, compiled, baseCtx)
  expect(errors).toEqual([])
  expect(warnings.map(w => w.code)).toEqual(['past_kitchen_close'])
})
