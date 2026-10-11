import { render, screen, waitFor, within } from '@testing-library/react'
import type { LoggedWorkoutExercise } from '@/data/types'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import { WorkoutRecordsGlass } from '@/features/train/components/WorkoutRecordsGlass'

// WorkoutRecordsGlass — the „Rekordok" sheet of the active workout, on real data only. Since Folyadék F4
// (mezo-n4wf5.4) a light sheet (prototype vilagos/edzes.js `recs`): „Múlt hét / Mai cél" cells on top, the last
// top set as facts, a level under each record, the rep records as rows.

const EX: LoggedWorkoutExercise = {
  id: 'e-1', name: 'Chest Supported Row', warmupSets: 2, workingSets: 3,
  repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null, type: 'compound',
  muscle: 'back-mid', sets: 5, prescribedSets: null, rationale: null,
  lastWeek: { weight: 102.5, reps: 9, rir: 2 },
}

const RECORD: ExerciseRecordResponse = {
  name: 'Chest Supported Row',
  muscle: 'back-mid',
  type: 'compound',
  bestSet: { weightKg: 107.5, reps: 8, date: '2026-08-12' },
  bestE1rm: { value: 140, set: { weightKg: 105, reps: 10, date: '2026-08-26' } },
  bestSessionVolume: { volumeKg: 3150, date: '2026-08-26' },
  totalVolume: 42000,
  totalSets: 130,
  totalReps: 1150,
  sessionCount: 26,
  repRecords: [
    { weightKg: 107.5, reps: 8, date: '2026-08-12' },
    { weightKg: 105, reps: 10, date: '2026-08-26' },
  ],
  recentTopSets: [],
}

const BODYWEIGHT_RECORD: ExerciseRecordResponse = {
  name: 'Face Pull',
  muscle: 'shoulder-rear',
  type: 'isolation',
  bestSet: { reps: 22, date: '2026-08-12' },
  totalVolume: 0,
  totalSets: 90,
  totalReps: 1600,
  sessionCount: 20,
  repRecords: [{ reps: 22, date: '2026-08-12' }],
  recentTopSets: [],
}

function baseProps() {
  return {
    open: true,
    exercise: EX,
    record: RECORD,
    todaySets: [],
    tint: '#abcdef',
    onClose: vi.fn(),
  }
}

test('a light sheet named after the exercise, with the muscle · alkalom context line', () => {
  render(<WorkoutRecordsGlass {...baseProps()} />)
  const dialog = screen.getByRole('dialog', { name: 'Chest Supported Row előzményei és rekordjai' })
  expect(dialog).toHaveClass('fo-sheet')
  expect(dialog.querySelector('[class*="wo-"], [class*="wos-"], [class*="gl-"]')).toBeNull()
  expect(within(dialog).getByRole('heading', { name: /Chest Supported Row/ })).toBeInTheDocument()
  expect(within(dialog).getByText(/ · 26 alkalom$/)).toBeInTheDocument()
})

// ── „Múlt hét / Mai cél" (owner, F4 round 2) ──
const PROGRESSION = { lever: 'weight' as const, deltaKg: 2.5, deltaReps: null, targetWeightKg: 105, targetReps: 9, rationale: '' }

test('the sheet opens with Múlt hét / Mai cél and the step against last week as a chip', () => {
  render(<WorkoutRecordsGlass {...baseProps()} exercise={{ ...EX, progression: PROGRESSION }} goal="105 × 9" />)
  const cells = document.querySelector('.ex-tg') as HTMLElement
  // the cells stand right under the head, above everything else
  expect(cells.previousElementSibling).toHaveClass('fo-shh')
  expect(within(cells).getByText('Múlt hét')).toBeInTheDocument()
  expect(within(cells).getByText('102,5 × 9 · RIR 2')).toBeInTheDocument()
  expect(within(cells).getByText('Mai cél')).toBeInTheDocument()
  expect(within(cells).getByText('105 × 9')).toBeInTheDocument()
  const chip = within(cells).getByText('+2,5 kg')
  expect(chip).toHaveClass('ex-dchip', 'up')
})

test('the chip follows the progression: down, hold; without a progression there is none', () => {
  const { rerender } = render(
    <WorkoutRecordsGlass {...baseProps()} goal="100 × 9" exercise={{ ...EX, progression: { ...PROGRESSION, deltaKg: -2.5 } }} />,
  )
  expect(screen.getByText('−2,5 kg')).toHaveClass('down')
  rerender(<WorkoutRecordsGlass {...baseProps()} goal="102,5 × 9" exercise={{ ...EX, progression: { ...PROGRESSION, lever: 'hold', deltaKg: null } }} />)
  expect(screen.getByText('tartjuk')).toHaveClass('ex-dchip')
  rerender(<WorkoutRecordsGlass {...baseProps()} goal="102,5 × 9" />)
  expect(document.querySelector('.ex-dchip')).toBeNull()
})

test('no goal handed over -> only the Múlt hét cell; no last week -> no cells at all', () => {
  const { rerender } = render(<WorkoutRecordsGlass {...baseProps()} />)
  expect(screen.getByText('Múlt hét')).toBeInTheDocument()
  expect(screen.queryByText('Mai cél')).not.toBeInTheDocument()
  rerender(<WorkoutRecordsGlass {...baseProps()} exercise={{ ...EX, lastWeek: null }} goal="105 × 9" />)
  expect(document.querySelector('.ex-tg')).toBeNull()
})

test('renders the three record bars from the fixture', () => {
  render(<WorkoutRecordsGlass {...baseProps()} />)
  expect(screen.getByText('Becsült 1RM')).toBeInTheDocument()
  expect(screen.getByText('140 kg')).toBeInTheDocument()
  expect(screen.getByText('Legjobb szett')).toBeInTheDocument()
  expect(screen.getByText('107,5 kg × 8')).toBeInTheDocument()
  expect(screen.getByText('Legtöbb volumen egy alkalmon')).toBeInTheDocument()
  expect(screen.getByText(/ óta áll · becslés, nem mérés$/)).toBeInTheDocument()
  // each record carries a level
  expect(document.querySelectorAll('.el-rec .fo-wlv')).toHaveLength(3)
  // Node's small-icu build has no hu-HU thousands grouping data — assert only the digits
  // and unit survive toLocaleString, not a specific separator (see fmtWhole's NBSP note).
  expect(screen.getByText(/^3.?150 kg × ism$/)).toBeInTheDocument()
})

test('the 1RM row carries the "becslés, nem mérés" note — with a record and without one', () => {
  const { rerender } = render(<WorkoutRecordsGlass {...baseProps()} />)
  expect(screen.getByText(/becslés, nem mérés/)).toBeInTheDocument()
  rerender(<WorkoutRecordsGlass {...baseProps()} record={undefined} />)
  expect(screen.getByText('becslés, nem mérés')).toBeInTheDocument()
})

test('lastWeek renders as three facts (kg · ism · RIR), honestly labelled', () => {
  render(<WorkoutRecordsGlass {...baseProps()} />)
  expect(screen.getByText('A múltkori alkalom · a legjobb munkaszetted')).toBeInTheDocument()
  const last = document.querySelector('.el-last') as HTMLElement
  expect(last).toHaveClass('fo-facts')
  expect(Array.from(last.querySelectorAll('b')).map((b) => b.textContent)).toEqual(['102,5', '9', '2'])
  expect(Array.from(last.querySelectorAll('small')).map((b) => b.textContent)).toEqual(['kg', 'ism', 'RIR'])
})

test('the rep records are rows: a record capsule, the weight, the date, the reps', () => {
  render(<WorkoutRecordsGlass {...baseProps()} />)
  expect(screen.getByText('Ismétlés-rekordok')).toBeInTheDocument()
  const rows = Array.from(document.querySelectorAll('.el-reprecs > .fo-row'))
  expect(rows).toHaveLength(2)
  expect(rows[0].querySelector('.ex-rc')).not.toBeNull()
  expect(within(rows[0] as HTMLElement).getByText('107,5 kg')).toBeInTheDocument()
  expect(rows[0].querySelector('.v')).toHaveTextContent('8 ism.')
  expect(rows[1].querySelector('.v')).toHaveTextContent('10 ism.')
})

test('no rep records -> no Ismétlés-rekordok block; the closing note always stands', () => {
  render(<WorkoutRecordsGlass {...baseProps()} record={{ ...RECORD, repRecords: [] }} />)
  expect(screen.queryByText('Ismétlés-rekordok')).not.toBeInTheDocument()
  expect(screen.getByText('A hosszabb távú ív a Gyakorlatok-oldal újraépítésével kerül majd ide.')).toBeInTheDocument()
})

test('null lastWeek renders one honest sentence instead of a fabricated row', () => {
  render(<WorkoutRecordsGlass {...baseProps()} exercise={{ ...EX, lastWeek: null }} />)
  expect(document.querySelector('.el-last')).toBeNull()
  expect(document.querySelector('.el-none')).toHaveTextContent('— ezt a gyakorlatot még nem csináltad.')
})

test('a today set that exceeds the best set flips it to „ma megdöntve” (a pill, a full gold level, no „ma …” line)', () => {
  // bestSet e1rm target = 107.5*(30+8)/30 = 136.2; e1RM record 140. A 120 kg x 5 set (e1RM 140) clears the first only.
  render(<WorkoutRecordsGlass {...baseProps()} todaySets={[{ weight: 120, reps: 5 }]} />)
  const pills = screen.getAllByText('ma megdöntve')
  expect(pills).toHaveLength(1)
  expect(pills[0]).toHaveClass('fo-st', 'ok')
  const row = pills[0].closest('.el-rec') as HTMLElement
  expect(within(row).getByText(/Legjobb szett/)).toBeInTheDocument()
  expect((row.querySelector('.fo-wlv > i') as HTMLElement).style.width).toBe('100%')
  expect((row.querySelector('.fo-wlv') as HTMLElement).style.getPropertyValue('--c')).toBe('var(--fo-gold)')
  expect(row.querySelector('.el-now')).toBeNull()
})

test('an unbeaten record shows the share of today as the level and „ma …” under it', () => {
  // 70 kg x 10 -> e1RM 93,3 of 140 = 66,7%; volume 700 of 3150 = 22,2%
  render(<WorkoutRecordsGlass {...baseProps()} todaySets={[{ weight: 70, reps: 10 }]} />)
  const rows = Array.from(document.querySelectorAll('.el-rec')) as HTMLElement[]
  expect(parseFloat((rows[0].querySelector('.fo-wlv > i') as HTMLElement).style.width)).toBeCloseTo(66.67, 1)
  expect(rows[0].querySelector('.el-now')).toHaveTextContent('ma 93,3 kg')
  expect(rows[1].querySelector('.el-now')).toHaveTextContent('ma 70 kg × 10')
  expect(parseFloat((rows[2].querySelector('.fo-wlv > i') as HTMLElement).style.width)).toBeCloseTo(22.22, 1)
  expect(rows[2].querySelector('.el-now')).toHaveTextContent('ma 700 kg × ism')
  expect(screen.queryByText('ma megdöntve')).not.toBeInTheDocument()
  expect(screen.queryByText(/Ma még nem naplóztál/)).not.toBeInTheDocument()
})

// Fix wave M1: "ma megdöntve" must name a record that actually EXISTS and is comparable.
test.each([
  {
    desc: 'no record row at all (first-ever logging): a fat set today beats nothing',
    record: undefined,
    exercise: EX,
  },
  {
    desc: 'a BODYWEIGHT best set has no weight → no comparable e1RM for today to clear',
    record: BODYWEIGHT_RECORD,
    exercise: { ...EX, name: 'Face Pull', muscle: 'shoulder-rear' } as LoggedWorkoutExercise,
  },
])('$desc', ({ record, exercise }) => {
  render(
    <WorkoutRecordsGlass {...baseProps()} exercise={exercise} record={record} todaySets={[{ weight: 120, reps: 5 }]} />,
  )
  expect(screen.queryByText('ma megdöntve')).not.toBeInTheDocument()
})

test('nothing logged today shows the empty-state copy, empty levels and no „ma megdöntve” anywhere', () => {
  render(<WorkoutRecordsGlass {...baseProps()} todaySets={[]} />)
  expect(screen.getByText('Ma még nem naplóztál ehhez szettet — a szintek üresen állnak.')).toBeInTheDocument()
  expect(screen.queryByText('ma megdöntve')).not.toBeInTheDocument()
  for (const level of Array.from(document.querySelectorAll('.el-rec .fo-wlv > i')) as HTMLElement[]) expect(level.style.width).toBe('0%')
  expect(document.querySelector('.el-now')).toBeNull()
})

test('a bodyweight record (no weightKg) renders reps-only, never "0 kg"', () => {
  render(
    <WorkoutRecordsGlass
      {...baseProps()}
      exercise={{ ...EX, name: 'Face Pull', muscle: 'shoulder-rear' }}
      record={BODYWEIGHT_RECORD}
    />,
  )
  expect(screen.getByText('22 ism.')).toBeInTheDocument()
  expect(screen.queryByText(/0 kg/)).not.toBeInTheDocument()
  // bestE1rm/bestSessionVolume absent on a bodyweight row -> em dash, never 0.
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
})

test('no record at all (never logged before) shows em dashes on every bar, not zeros', () => {
  render(<WorkoutRecordsGlass {...baseProps()} record={undefined} />)
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  expect(screen.queryByText(/0 kg/)).not.toBeInTheDocument()
})

test('closes via the × button; closed renders nothing', async () => {
  const { default: userEvent } = await import('@testing-library/user-event')
  const user = userEvent.setup()
  const props = baseProps()
  const { rerender } = render(<WorkoutRecordsGlass {...props} />)
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce())
  rerender(<WorkoutRecordsGlass {...props} open={false} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
