import { compileTemplate } from '@/features/fuel/logic/compileTemplate'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { SlotAnchor, SlotTemplate, SlotTemplateRow } from '@/data/types'

const WAKE = '05:30' // eatingStart = 05:30 + 45 = 375 (06:15)
const BED = '22:00' // kitchenClose = 22:00 - 90 = 1230 (20:30)
const GYM: PlannerBlock = { kind: 'gym', time: '07:00', durationMin: 60, label: 'Gym' }

const row = (anchor: SlotAnchor, over: Partial<SlotTemplateRow> = {}): SlotTemplateRow => ({
  label: 'Reggeli', slotKind: 'breakfast', role: 'standard', anchor, budgetPct: 25, ...over,
})
const template = (...slots: SlotTemplateRow[]): SlotTemplate => ({ dayType: 'training_am', slots })
const compile = (t: SlotTemplate, blocks: PlannerBlock[] = [GYM], wake = WAKE, bed = BED) =>
  compileTemplate(t, { wake, bed, blocks })

test('a fixed anchor resolves to its literal clock time', () => {
  const out = compile(template(row({ type: 'fixed', time: '12:00' })))
  expect(out[0].time).toBe(720)
})

test('a wake-relative anchor resolves to wake + offsetMin', () => {
  const out = compile(template(row({ type: 'wake', offsetMin: 45 })))
  expect(out[0].time).toBe(375)
})

test('a bed-relative anchor resolves to bed + the SIGNED offsetMin', () => {
  const out = compile(template(row({ type: 'bed', offsetMin: -120 })))
  expect(out[0].time).toBe(1200)
})

test('a training_start anchor resolves to the earliest block start + offsetMin', () => {
  const out = compile(template(row({ type: 'training_start', offsetMin: -45 })))
  expect(out[0].time).toBe(375)
})

test('a training_end anchor resolves to the latest block end + offsetMin', () => {
  const out = compile(template(row({ type: 'training_end', offsetMin: 30 })))
  expect(out[0].time).toBe(510)
})

test('training_end on a null-duration gym/sport block falls back to DEFAULT_BLOCK_MIN', () => {
  const gymNoDuration: PlannerBlock = { kind: 'gym', time: '07:00', durationMin: null, label: 'Gym' }
  const out = compile(template(row({ type: 'training_end', offsetMin: 0 })), [gymNoDuration])
  expect(out[0].time).toBe(480) // 07:00 (420) + DEFAULT_BLOCK_MIN (60)
})

test('training_end on a null-duration run block falls back to DEFAULT_RUN_MIN', () => {
  const run: PlannerBlock = { kind: 'run', time: '07:00', durationMin: null, label: 'Run' }
  const out = compile(template(row({ type: 'training_end', offsetMin: 0 })), [run])
  expect(out[0].time).toBe(465) // 07:00 (420) + DEFAULT_RUN_MIN (45)
})

test('two unsorted blocks: training_start uses the EARLIEST start, training_end the LATEST end', () => {
  const sport: PlannerBlock = { kind: 'sport', time: '18:00', durationMin: 30, label: 'Sport' }
  const gym: PlannerBlock = { kind: 'gym', time: '07:00', durationMin: 60, label: 'Gym' }
  const out = compile(
    template(
      row({ type: 'training_start', offsetMin: 0 }, { label: 'Start' }),
      row({ type: 'training_end', offsetMin: 0 }, { label: 'End' }),
    ),
    [sport, gym], // unsorted: sport (18:00) listed before gym (07:00)
  )
  expect(out.find(w => w.label === 'Start')!.time).toBe(420) // gym start 07:00
  expect(out.find(w => w.label === 'End')!.time).toBe(1110) // sport end 18:30
})

test('a wake+0 slot clamps up to eatingStart (wake+45)', () => {
  const out = compile(template(row({ type: 'wake', offsetMin: 0 })))
  expect(out[0].time).toBe(375)
})

test('a bed-30 slot clamps down to kitchenClose (bed-90)', () => {
  const out = compile(template(row({ type: 'bed', offsetMin: -30 })))
  expect(out[0].time).toBe(1230)
})

test('two slots resolving 30 minutes apart are forward-pushed to MIN_SLOT_GAP_MIN', () => {
  const out = compile(
    template(
      row({ type: 'fixed', time: '10:00' }, { label: 'First' }),
      row({ type: 'fixed', time: '10:30' }, { label: 'Second' }),
    ),
  )
  expect(out.find(w => w.label === 'First')!.time).toBe(600)
  expect(out.find(w => w.label === 'Second')!.time).toBe(690) // 600 + MIN_SLOT_GAP_MIN (90)
})

test('the gap-push is capped at kitchenClose, never spilling past it', () => {
  const out = compile(
    template(
      row({ type: 'fixed', time: '20:00' }, { label: 'First' }), // 1200
      row({ type: 'fixed', time: '20:20' }, { label: 'Second' }), // 1220, would push to 1290
    ),
  )
  expect(out.find(w => w.label === 'Second')!.time).toBe(1230) // capped at kitchenClose
})

test('a training-anchored slot on a blockless day is defensively dropped', () => {
  const out = compile(template(row({ type: 'training_start', offsetMin: -45 })), [])
  expect(out).toEqual([])
})

test('output carries slotKey/kind/label/budgetPct/role, and a snack slotKind maps to kind snack', () => {
  const out = compile(
    template(row({ type: 'fixed', time: '10:00' }, { slotKind: 'snack', label: 'Tízórai', role: 'pre_workout', budgetPct: 10 })),
  )
  expect(out[0]).toMatchObject({ slotKey: 'snack', kind: 'snack', label: 'Tízórai', budgetPct: 10, role: 'pre_workout', weight: 10 })
})

test('a non-snack slotKind maps to kind meal', () => {
  const out = compile(template(row({ type: 'fixed', time: '10:00' }, { slotKind: 'dinner', role: 'post_workout', budgetPct: 35 })))
  expect(out[0]).toMatchObject({ slotKey: 'dinner', kind: 'meal', role: 'post_workout', budgetPct: 35 })
})

test('output is sorted by resolved time regardless of template row order', () => {
  const out = compile(
    template(
      row({ type: 'fixed', time: '13:00' }, { label: 'Later' }),
      row({ type: 'fixed', time: '08:00' }, { label: 'Earlier' }),
    ),
  )
  expect(out.map(w => w.label)).toEqual(['Earlier', 'Later'])
})
