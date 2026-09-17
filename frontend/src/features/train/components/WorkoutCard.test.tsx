import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WorkoutCard } from '@/features/train/components/WorkoutCard'
import { makeSession, completeSet, skipExercise, type Session } from '@/features/train/logic/workoutState'
import type { LoggedWorkoutExercise, PrescribedSet } from '@/data/types'

// Two warmups then three working sets — the same shape the engine prescribes for a
// compound. The warm-up ramp is still PRESCRIBED (nothing is renumbered in the model);
// the card just never shows it (mezo-i8ahy), so these fixtures prove the rows, the
// counts and the prescription addressing all land on the WORKING slots.
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

test('renders one row per WORKING slot — the prescribed warm-ups are not shown', () => {
  const { container } = renderCard()
  expect(container.querySelectorAll('.wo-row')).toHaveLength(3)
  expect(container.querySelector('.wo-rows-head')).toBeInTheDocument()
  // No B-prefixed warm-up index survives anywhere on the card.
  expect([...container.querySelectorAll('.wo-idx')].map((n) => n.textContent)).toEqual(['1', '2', '3'])
})

test('the header strip and the rows share ONE column grid', () => {
  const { container } = renderCard()
  const head = container.querySelector('.wo-rows-head')!
  const row = container.querySelector('.wo-row')!
  // Six cells each: # · KG · REP · RIR · ✓ · verdict.
  expect(head.children).toHaveLength(6)
  expect(row.children).toHaveLength(6)
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

test('an accepted challenge on this exercise renders its target as a chip (mezo-88iwa.7)', () => {
  const { container } = renderCard({ challenge: { label: 'PR kísérlet', target: '85 kg × 8' } })
  expect(container.querySelector('.wo-note')).toHaveTextContent('85 kg × 8')
})

test('with no accepted challenge, no challenge chip renders', () => {
  const { container } = renderCard()
  expect(container.querySelector('[aria-label^="Elfogadott kihívás"]')).toBeNull()
})

test('only the NEXT pending row has enabled inputs — later slots are inert', () => {
  const { container } = renderCard()
  // The one editable row is a form; later pending rows are plain divs.
  expect(container.querySelectorAll('form.wo-row')).toHaveLength(1)
  // Three inline fields on that one row: kg, rep and RIR (mezo-i8ahy).
  expect(container.querySelectorAll('.wo-row input')).toHaveLength(3)
  const inputs = screen.getAllByRole('spinbutton')
  expect(inputs).toHaveLength(3)
  for (const input of inputs) expect(input).toBeEnabled()
})

test('the editable row prefills kg/reps/RIR from the first WORKING slot\'s target', () => {
  renderCard()
  // The warm-up rungs (52,5 × 8 and 80 × 3) are skipped — the cursor sits on slot 3 of
  // the prescription, the first working set.
  expect(screen.getByLabelText(/súly$/)).toHaveValue(105)
  expect(screen.getByLabelText(/ismétlés$/)).toHaveValue(10)
  expect(screen.getByLabelText(/RIR$/)).toHaveValue(2)
})

test('the RIR field is inline on the row, and the pill strip is gone', () => {
  const { container } = renderCard()
  const row = container.querySelector('form.wo-row')!
  expect(within(row as HTMLElement).getByLabelText(/RIR$/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'RIR 0' })).toBeNull()
  expect(container.querySelector('.wo-pick')).toBeNull()
})

test('the RIR field holds the 0–5 contract', () => {
  renderCard()
  const rir = screen.getByLabelText(/RIR$/)
  expect(rir).toHaveAttribute('min', '0')
  expect(rir).toHaveAttribute('max', '5')
  expect(rir).toHaveAttribute('inputmode', 'numeric')
})

test('the ✓ submits the typed values, RIR included', async () => {
  const user = userEvent.setup()
  const { props } = renderCard()
  const kg = screen.getByLabelText(/súly$/)
  await user.clear(kg)
  await user.type(kg, '60')
  const reps = screen.getByLabelText(/ismétlés$/)
  await user.clear(reps)
  await user.type(reps, '7')
  const rir = screen.getByLabelText(/RIR$/)
  await user.clear(rir)
  await user.type(rir, '1')
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith({ weight: 60, reps: 7, rir: 1, side: null })
})

test('the cursor lands on the SECOND working slot once the first is logged', async () => {
  const user = userEvent.setup()
  let session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, id: 's0' })
  const { props } = renderCard({ session })
  await user.click(screen.getByRole('button', { name: '2. szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith({ weight: 105, reps: 10, rir: 2, side: null })
})

test('an isolation exercise offers the L/B/R side segment, and it rides the log payload', async () => {
  const user = userEvent.setup()
  const exercise = makeExercise({ type: 'isolation', warmupSets: 0, workingSets: 1, sets: 1, prescribedSets: [PRESCRIBED[2]] })
  const { props } = renderCard({ exercise })
  await user.click(screen.getByRole('button', { name: 'Oldal L' }))
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith(expect.objectContaining({ side: 'L' }))
})

test('a done row tap fires onTapDoneRow', async () => {
  const user = userEvent.setup()
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, id: 'srv-1' })
  const { props } = renderCard({ session })
  await user.click(screen.getByRole('button', { name: /1\. szett szerkesztése/ }))
  expect(props.onTapDoneRow).toHaveBeenCalledWith(0)
})

test('a done row whose server id has not landed yet is NOT tappable (mezo-l3on)', () => {
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, localId: 'loc-1' })
  renderCard({ session })
  expect(screen.getByRole('button', { name: /1\. szett szerkesztése/ })).toBeDisabled()
})

test('a done row whose POST is KNOWN to have failed is tappable again (mezo-l3on F1)', () => {
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, localId: 'loc-1' })
  renderCard({ session, failedLocalIds: new Set(['loc-1']) })
  expect(screen.getByRole('button', { name: /1\. szett szerkesztése/ })).toBeEnabled()
})

test('a RECORD medal renders its chip in the done row\'s end cell', () => {
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, id: 'srv-1' })
  renderCard({
    session,
    medalsBySetIdx: { 0: [{ type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Chest Supported Row', setIndex: 0, label: 'Súly-rekord', value: '105 kg' } as never] },
  })
  const row = screen.getByRole('button', { name: /1\. szett szerkesztése/ })
  expect(within(row).getByText(/Súly-rekord|105/)).toBeInTheDocument()
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
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith(expect.objectContaining({ weight: 0 }))
})
