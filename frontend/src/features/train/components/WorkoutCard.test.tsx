import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WorkoutCard } from '@/features/train/components/WorkoutCard'
import { makeSession, completeSet, skipExercise, type Session } from '@/features/train/logic/workoutState'
import type { LoggedWorkoutExercise, PrescribedSet } from '@/data/types'

// Two warmups then three working sets — the same shape the engine prescribes for a
// compound, so the card's B1/B2 amber labels and the "no RIR on a warmup" rule both
// have something to bite on.
const PRESCRIBED: PrescribedSet[] = [
  { kind: 'warmup', targetWeightKg: 52.5, targetReps: 8, targetRIR: null },
  { kind: 'warmup', targetWeightKg: 80, targetReps: 3, targetRIR: null },
  { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 2 },
  { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 2 },
  { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 2 },
]

function makeExercise(over: Partial<LoggedWorkoutExercise> = {}): LoggedWorkoutExercise {
  return {
    id: 'ex1',
    name: 'Chest Supported Row',
    warmupSets: 2,
    workingSets: 3,
    repMin: 8,
    repMax: 10,
    targetRIR: 2,
    anchorWeightKg: 100,
    type: 'compound',
    muscle: 'back-mid',
    sets: 5,
    prescribedSets: PRESCRIBED,
    rationale: 'A múlt heti RIR alapján tartjuk a súlyt.',
    lastWeek: { weight: 102.5, reps: 9, rir: 2 },
    ...over,
  }
}

function makeProps(over: Partial<React.ComponentProps<typeof WorkoutCard>> = {}) {
  const exercise = over.exercise ?? makeExercise()
  const session = over.session ?? makeSession([
    { id: exercise.id, warmupSets: exercise.warmupSets, workingSets: exercise.workingSets, prescribedSets: exercise.prescribedSets },
  ])
  return {
    exercise,
    session,
    busy: false,
    onLogSet: vi.fn(),
    onTapDoneRow: vi.fn(),
    onOpenRecords: vi.fn(),
    onOpenMenu: vi.fn(),
    onEditNote: vi.fn(),
    ...over,
  }
}

function renderCard(over: Partial<React.ComponentProps<typeof WorkoutCard>> = {}) {
  const props = makeProps(over)
  const utils = render(<WorkoutCard {...props} />)
  return { ...utils, props }
}

test('renders one row per effective slot, plus the column header', () => {
  const { container } = renderCard()
  expect(container.querySelectorAll('.wo-row')).toHaveLength(5)
  expect(container.querySelector('.wo-rows-head')).toBeInTheDocument()
})

test('the head carries the name, the records button and the ⋮ menu button', async () => {
  const user = userEvent.setup()
  const { props } = renderCard()
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Chest Supported Row · előzmények és rekordok' }))
  expect(props.onOpenRecords).toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Chest Supported Row · további műveletek' }))
  expect(props.onOpenMenu).toHaveBeenCalled()
})

test('the saved note renders as a .wo-note pill that opens the note editor', async () => {
  const user = userEvent.setup()
  const { container, props } = renderCard({ note: 'Lapockát hátra' })
  expect(container.querySelector('.wo-note')).toHaveTextContent('Lapockát hátra')
  await user.click(screen.getByRole('button', { name: 'Gyakorlat-jegyzet' }))
  expect(props.onEditNote).toHaveBeenCalled()
})

test('the rationale renders as the .wo-cue sentence (the plan\'s own words)', () => {
  const { container } = renderCard()
  expect(container.querySelector('.wo-cue p')).toHaveTextContent('A múlt heti RIR alapján tartjuk a súlyt.')
})

test('only the NEXT pending row has enabled inputs — later slots are inert', () => {
  const { container } = renderCard()
  // The one editable row is a form; later pending rows are plain divs.
  expect(container.querySelectorAll('form.wo-row')).toHaveLength(1)
  expect(container.querySelectorAll('.wo-row input')).toHaveLength(2)
  const inputs = screen.getAllByRole('spinbutton')
  expect(inputs).toHaveLength(2)
  for (const input of inputs) expect(input).toBeEnabled()
})

test('the editable row prefills kg/reps from the slot\'s prescribed target', () => {
  renderCard()
  expect(screen.getByLabelText(/súly$/)).toHaveValue(52.5)
  expect(screen.getByLabelText(/ismétlés$/)).toHaveValue(8)
})

test('a warmup slot shows an amber B-index and NO RIR pills', () => {
  renderCard()
  expect(screen.getByLabelText(/B1 bemelegítő szett, súly/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'RIR 0' })).toBeNull()
})

test('a working slot offers six RIR pills, with the prescribed targetRIR pre-pressed', () => {
  // Both warmups already logged → the cursor sits on the first WORKING slot.
  let session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 52.5, reps: 8, rir: 0, id: 's0' })
  session = completeSet(session, 'ex1', { weight: 80, reps: 3, rir: 0, id: 's1' })
  renderCard({ session })
  const pills = [0, 1, 2, 3, 4, 5].map((n) => screen.getByRole('button', { name: `RIR ${n}` }))
  expect(pills).toHaveLength(6)
  expect(screen.getByRole('button', { name: 'RIR 2' })).toHaveAttribute('aria-pressed', 'true')
  for (const n of [0, 1, 3, 4, 5]) {
    expect(screen.getByRole('button', { name: `RIR ${n}` })).toHaveAttribute('aria-pressed', 'false')
  }
})

test('the ✓ submits the typed values — rir null on a warmup slot', async () => {
  const user = userEvent.setup()
  const { props } = renderCard()
  const kg = screen.getByLabelText(/súly$/)
  await user.clear(kg)
  await user.type(kg, '60')
  const reps = screen.getByLabelText(/ismétlés$/)
  await user.clear(reps)
  await user.type(reps, '7')
  await user.click(screen.getByRole('button', { name: 'B1 bemelegítő szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith({ weight: 60, reps: 7, rir: null, side: null })
})

test('the ✓ submits the picked RIR on a working slot', async () => {
  const user = userEvent.setup()
  let session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 52.5, reps: 8, rir: 0, id: 's0' })
  session = completeSet(session, 'ex1', { weight: 80, reps: 3, rir: 0, id: 's1' })
  const { props } = renderCard({ session })
  await user.click(screen.getByRole('button', { name: 'RIR 1' }))
  await user.click(screen.getByRole('button', { name: '1. working szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith({ weight: 105, reps: 10, rir: 1, side: null })
})

test('an isolation exercise offers the L/B/R side segment, and it rides the log payload', async () => {
  const user = userEvent.setup()
  const exercise = makeExercise({ type: 'isolation', warmupSets: 0, workingSets: 1, sets: 1, prescribedSets: [PRESCRIBED[2]] })
  const { props } = renderCard({ exercise })
  await user.click(screen.getByRole('button', { name: 'Oldal L' }))
  await user.click(screen.getByRole('button', { name: '1. working szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith(expect.objectContaining({ side: 'L' }))
})

test('a done row tap fires onTapDoneRow', async () => {
  const user = userEvent.setup()
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 52.5, reps: 8, rir: 0, id: 'srv-1' })
  const { props } = renderCard({ session })
  await user.click(screen.getByRole('button', { name: /B1 bemelegítő szett szerkesztése/ }))
  expect(props.onTapDoneRow).toHaveBeenCalledWith(0)
})

test('a done row whose server id has not landed yet is NOT tappable (mezo-l3on)', () => {
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 52.5, reps: 8, rir: 0, localId: 'loc-1' })
  renderCard({ session })
  expect(screen.getByRole('button', { name: /B1 bemelegítő szett szerkesztése/ })).toBeDisabled()
})

test('a done row whose POST is KNOWN to have failed is tappable again (mezo-l3on F1)', () => {
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 52.5, reps: 8, rir: 0, localId: 'loc-1' })
  renderCard({ session, failedLocalIds: new Set(['loc-1']) })
  expect(screen.getByRole('button', { name: /B1 bemelegítő szett szerkesztése/ })).toBeEnabled()
})

test('a RECORD medal renders its chip in the done row\'s end cell', () => {
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 52.5, reps: 8, rir: 0, id: 'srv-1' })
  renderCard({
    session,
    medalsBySetIdx: { 0: [{ type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Chest Supported Row', setIndex: 0, label: 'Súly-rekord', value: '52,5 kg' } as never] },
  })
  const row = screen.getByRole('button', { name: /B1 bemelegítő szett szerkesztése/ })
  expect(within(row).getByText(/Súly-rekord|52,5/)).toBeInTheDocument()
})

test('a skipped exercise renders collapsed with the KIHAGYVA tag and no rows', () => {
  const session = skipExercise(
    makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }]),
    'ex1',
  )
  const { container } = renderCard({ session })
  expect(container.querySelector('.wo-card')).toHaveClass('is-skipped')
  expect(screen.getByText('KIHAGYVA')).toBeInTheDocument()
  expect(container.querySelectorAll('.wo-row')).toHaveLength(0)
})

test('an all-logged exercise is marked is-complete and offers no editable row', () => {
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 0, workingSets: 1, prescribedSets: [PRESCRIBED[2]] }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, id: 'srv-1' })
  const { container } = renderCard({ session })
  expect(container.querySelector('.wo-card')).toHaveClass('is-complete')
  expect(container.querySelectorAll('form.wo-row')).toHaveLength(0)
})

test('a plyo exercise logs weightKg 0 and disables the kg input', async () => {
  const user = userEvent.setup()
  const exercise = makeExercise({ type: 'plyo', warmupSets: 0, workingSets: 1, sets: 1, prescribedSets: [PRESCRIBED[2]] })
  const { props } = renderCard({ exercise })
  expect(screen.getByLabelText(/súly$/)).toBeDisabled()
  await user.click(screen.getByRole('button', { name: '1. working szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith(expect.objectContaining({ weight: 0 }))
})
