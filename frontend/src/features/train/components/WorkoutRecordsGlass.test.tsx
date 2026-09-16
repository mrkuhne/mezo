import { render, screen, within } from '@testing-library/react'
import type { LoggedWorkoutExercise } from '@/data/types'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import { WorkoutRecordsGlass } from '@/features/train/components/WorkoutRecordsGlass'

// WorkoutRecordsGlass (mezo-88iwa.7, T6 Task 5) — the records glass, GlassBox-hosted.
// Ports the prototype's `historyGlass` (session.js:161-230) onto real data only.

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

test('renders the exercise name and muscle · alkalom eyebrow in the glass head', () => {
  render(<WorkoutRecordsGlass {...baseProps()} />)
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Chest Supported Row', { selector: 'strong' })).toBeInTheDocument()
  expect(within(dialog).getByText(/26 ALKALOM/)).toBeInTheDocument()
})

test('renders the three record bars from the fixture', () => {
  render(<WorkoutRecordsGlass {...baseProps()} />)
  expect(screen.getByText('BECSÜLT 1RM')).toBeInTheDocument()
  expect(screen.getByText('140 kg')).toBeInTheDocument()
  expect(screen.getByText('LEGJOBB SZETT')).toBeInTheDocument()
  expect(screen.getByText('107,5 kg × 8')).toBeInTheDocument()
  expect(screen.getByText('LEGTÖBB VOLUMEN egy alkalmon')).toBeInTheDocument()
  // Node's small-icu build has no hu-HU thousands grouping data — assert only the digits
  // and unit survive toLocaleString, not a specific separator (see fmtWhole's NBSP note).
  expect(screen.getByText(/^3.?150 kg × rep$/)).toBeInTheDocument()
})

test('the 1RM bar carries the "Becslés, nem mérés" note', () => {
  render(<WorkoutRecordsGlass {...baseProps()} />)
  expect(screen.getByText(/Becslés, nem mérés/)).toBeInTheDocument()
})

test('lastWeek renders as a single .wo-last row honestly labelled', () => {
  render(<WorkoutRecordsGlass {...baseProps()} />)
  expect(screen.getByText('A múltkori legjobb munkaszetted')).toBeInTheDocument()
  const last = document.querySelector('.wo-last') as HTMLElement
  expect(within(last).getAllByRole('generic', { hidden: true })).toBeDefined() // sanity: rendered
  expect(within(last).getByText('102,5')).toBeInTheDocument()
  expect(within(last).getByText('9')).toBeInTheDocument()
  expect(within(last).getByText('2')).toBeInTheDocument()
  expect(document.querySelectorAll('.wo-last-row')).toHaveLength(3) // last-week row + 2 rep-record rows
})

test('null lastWeek renders an em dash instead of a fabricated row', () => {
  render(<WorkoutRecordsGlass {...baseProps()} exercise={{ ...EX, lastWeek: null }} />)
  expect(document.querySelector('.wo-rec-empty')).toHaveTextContent('—')
})

test('a today set that exceeds the best set flips it to MA MEGDÖNTVE', () => {
  // bestSet e1rm target = 107.5*(30+8)/30 = 108.65..; a 120kg x 5 set clears it easily.
  render(<WorkoutRecordsGlass {...baseProps()} todaySets={[{ weight: 120, reps: 5 }]} />)
  expect(screen.getAllByText('MA MEGDÖNTVE').length).toBeGreaterThan(0)
})

test('nothing logged today shows the empty-state copy and no MEGDÖNTVE anywhere', () => {
  render(<WorkoutRecordsGlass {...baseProps()} todaySets={[]} />)
  expect(screen.getByText('Ma még nem logoltál ehhez szettet — a sávok üresen állnak.')).toBeInTheDocument()
  expect(screen.queryByText('MA MEGDÖNTVE')).not.toBeInTheDocument()
})

test('a bodyweight record (no weightKg) renders reps-only, never "0 kg"', () => {
  render(
    <WorkoutRecordsGlass
      {...baseProps()}
      exercise={{ ...EX, name: 'Face Pull', muscle: 'shoulder-rear' }}
      record={BODYWEIGHT_RECORD}
    />,
  )
  expect(screen.getByText('22 rep')).toBeInTheDocument()
  expect(screen.queryByText(/0 kg/)).not.toBeInTheDocument()
  // bestE1rm/bestSessionVolume absent on a bodyweight row -> em dash, never 0.
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
})

test('no record at all (never logged before) shows em dashes on every bar, not zeros', () => {
  render(<WorkoutRecordsGlass {...baseProps()} record={undefined} />)
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  expect(screen.queryByText(/0 kg/)).not.toBeInTheDocument()
})

test('closes via the GlassBox × button', async () => {
  const { default: userEvent } = await import('@testing-library/user-event')
  const user = userEvent.setup()
  const props = baseProps()
  render(<WorkoutRecordsGlass {...props} />)
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  expect(props.onClose).toHaveBeenCalledOnce()
})
