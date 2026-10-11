import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { WorkoutCard, WorkoutRow, exerciseGoal } from '@/features/train/components/WorkoutCard'
import { makeSession, completeSet, skipExercise, type Session } from '@/features/train/logic/workoutState'
import type { LoggedWorkoutExercise, PrescribedSet } from '@/data/types'

// Two warmups then three working sets — the same shape the engine prescribes for a
// compound. The warm-up ramp is still PRESCRIBED (nothing is renumbered in the model);
// the card just never shows it (mezo-i8ahy), so these fixtures prove the rows, the
// counts and the prescription addressing all land on the WORKING slots.
// Folyadék F4 (mezo-n4wf5.4): `WorkoutCard` is the exercise ON TOP (the hero with the shared `SetGrid`), `WorkoutRow`
// is an exercise that is not; the logging rules of the old card are unchanged and are what this file pins.
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

const gridRows = (c: HTMLElement) => Array.from(c.querySelectorAll('.ex-sets > .r')) as HTMLElement[]
const kgField = () => screen.getByRole('textbox', { name: /súly$/ })
const repsField = () => screen.getByRole('textbox', { name: /ismétlés$/ })
const rirField = () => screen.getByRole('textbox', { name: /RIR \(0–5\)$/ })

test('renders one row per WORKING slot — the prescribed warm-ups are not shown', () => {
  const { container } = renderCard()
  expect(gridRows(container)).toHaveLength(3)
  // No B-prefixed warm-up index survives anywhere on the card.
  expect([...container.querySelectorAll('.ex-sets .n')].map((n) => n.textContent)).toEqual(['1', '2', '3'])
})

test('the grid has ONE column head: # · kg · ism · RIR (+ the mark column)', () => {
  const { container } = renderCard()
  expect([...container.querySelectorAll('.ex-sets > .h')].map((n) => n.textContent)).toEqual(['#', 'kg', 'ism', 'RIR'])
  // Five cells per row: # · kg · ism · RIR · ✓ / mark.
  for (const row of gridRows(container)) expect(row.children).toHaveLength(5)
})

test('the hero is lean: the name, the Rekordok tool and the corner three-dot menu — no eyebrow, no chip, no cells', async () => {
  const user = userEvent.setup()
  const { container, props } = renderCard({ exercise: makeExercise({
    progression: { lever: 'weight', deltaKg: 2.5, deltaReps: null, targetWeightKg: 105, targetReps: 8, rationale: 'x' },
  }) })
  const hero = container.querySelector('.ek-hero') as HTMLElement
  expect(hero).toHaveAttribute('aria-label', 'Chest Supported Row')
  expect(hero.querySelector('.fo-hero-verdict')).toHaveTextContent('Chest Supported Row')
  expect(hero.querySelector('.fo-hero-lbl')).toBeNull()
  // Owner round: the vs-last-week chip and the Múlt hét / Mai cél cells are NOT on the hero (row / Rekordok sheet).
  expect(hero.querySelector('.ex-dchip')).toBeNull()
  expect(hero.querySelector('.ex-tg')).toBeNull()
  expect(screen.queryByText('Múlt hét')).toBeNull()
  expect(screen.queryByText('Mai cél')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Chest Supported Row · előzmények és rekordok' }))
  expect(props.onOpenRecords).toHaveBeenCalled()
  const dots = screen.getByRole('button', { name: 'Chest Supported Row · további műveletek' })
  expect(dots.parentElement).toBe(hero)
  await user.click(dots)
  expect(props.onOpenMenu).toHaveBeenCalled()
})

test('Technika exists only when the exercise has a video, and opens it', async () => {
  const user = userEvent.setup()
  const without = renderCard()
  expect(screen.queryByRole('button', { name: 'Technika' })).toBeNull()
  without.unmount()
  const onOpenVideo = vi.fn()
  renderCard({ onOpenVideo })
  await user.click(screen.getByRole('button', { name: 'Technika' }))
  expect(onOpenVideo).toHaveBeenCalled()
})

test('the saved note renders as a quiet line that opens the note editor', async () => {
  const user = userEvent.setup()
  const { props } = renderCard({ note: 'Lapockát hátra' })
  const line = screen.getByRole('button', { name: 'Gyakorlat-jegyzet' })
  expect(line).toHaveClass('ex-xl')
  expect(line).toHaveTextContent('Lapockát hátra')
  await user.click(line)
  expect(props.onEditNote).toHaveBeenCalled()
})

test('an exercise WITH a lastWeek renders no reason line even when the plan carries a rationale', () => {
  const { container } = renderCard()
  expect(container.querySelector('.ex-xl')).toBeNull()
})

test('a first-ever exercise (no lastWeek) renders the rationale as the ONE reason line', () => {
  const { container } = renderCard({ exercise: makeExercise({ lastWeek: null }) })
  expect(container.querySelectorAll('.ex-xl')).toHaveLength(1)
  expect(container.querySelector('p.ex-xl')).toHaveTextContent('A múlt heti RIR alapján tartjuk a súlyt.')
})

test('a target past the range top carries the engine\'s reason in the same line (mezo-bk7sn)', () => {
  const why = 'A 105 kg +2% ugrás lenne → előbb 11 ismétlés 102,5 kg-mal'
  const { container } = renderCard({ exercise: makeExercise({
    progression: { lever: 'rep', deltaKg: null, deltaReps: 1, targetWeightKg: 102.5, targetReps: 11, rationale: why },
  }) })
  expect(container.querySelectorAll('.ex-xl')).toHaveLength(1)
  expect(container.querySelector('p.ex-xl')).toHaveTextContent(why)
})

test('a küldetés taken on at Indulás renders as a tappable line that opens its sheet (mezo-mgu2r)', async () => {
  const user = userEvent.setup()
  const onOpenChallenge = vi.fn()
  renderCard({ challenges: [{ id: 'c1', label: 'Rekord-kísérlet', target: '85 kg × 8', state: 'accepted' }], onOpenChallenge })
  const badge = screen.getByRole('button', { name: 'Rekord-kísérlet küldetés · vállalva' })
  expect(badge).toHaveTextContent('Rekord-kísérlet · 85 kg × 8')
  await user.click(badge)
  expect(onOpenChallenge).toHaveBeenCalledWith('c1')
})

test('a released küldetés stays on the hero, struck through', () => {
  renderCard({ challenges: [{ id: 'c1', label: 'Rekord-kísérlet', target: '85 kg × 8', state: 'released' }] })
  const badge = screen.getByRole('button', { name: 'Rekord-kísérlet küldetés · elengedve' })
  expect(badge).toHaveClass('rel')
  expect(badge).toHaveTextContent('elengedve · 85 kg × 8')
  expect(badge.querySelector('s')).toHaveTextContent('85 kg × 8')
})

test('a resolved küldetés reads „lezárva"', () => {
  renderCard({ challenges: [{ id: 'c1', label: 'Mélység', target: '12 ism.', state: 'hit' }] })
  expect(screen.getByRole('button', { name: 'Mélység küldetés · lezárva' })).toBeInTheDocument()
})

test('with no küldetés, no line renders', () => {
  renderCard()
  expect(screen.queryByRole('button', { name: /küldetés ·/ })).toBeNull()
})

test('only the NEXT pending row has fields — later slots are inert', () => {
  const { container } = renderCard()
  // The one editable row is a form; later pending rows are plain groups.
  expect(container.querySelectorAll('.ex-sets > form.r')).toHaveLength(1)
  // Three inline fields on that one row: kg, ism and RIR (mezo-i8ahy) — text fields on the right keypads.
  const inputs = screen.getAllByRole('textbox')
  expect(inputs).toHaveLength(3)
  for (const input of inputs) expect(input).toBeEnabled()
  expect(kgField()).toHaveAttribute('inputmode', 'decimal')
  expect(repsField()).toHaveAttribute('inputmode', 'numeric')
  expect(rirField()).toHaveAttribute('inputmode', 'numeric')
  const later = screen.getByRole('group', { name: '2. szett · terv' })
  expect(within(later).queryAllByRole('textbox')).toHaveLength(0)
  expect(later).toHaveTextContent('105')
  expect(later).toHaveTextContent('8–10')
})

test('the editable row prefills kg/reps/RIR from the first WORKING slot\'s target', () => {
  renderCard()
  // The warm-up rungs (52,5 × 8 and 80 × 3) are skipped — the cursor sits on slot 3 of
  // the prescription, the first working set.
  expect(kgField()).toHaveValue('105')
  expect(repsField()).toHaveValue('10')
  expect(rirField()).toHaveValue('2')
})

test('the RIR field is inline on the row, and no pill strip stands under it', () => {
  const { container } = renderCard()
  const row = container.querySelector('.ex-sets > form.r') as HTMLElement
  expect(within(row).getByRole('textbox', { name: /RIR \(0–5\)$/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'RIR 0' })).toBeNull()
  // A compound has no side picker either.
  expect(container.querySelector('.ex-side')).toBeNull()
})

test('the RIR field holds the 0–5 contract: one digit, the last key wins, clamped', async () => {
  const user = userEvent.setup()
  const { props } = renderCard()
  const rir = rirField()
  await user.type(rir, '9')
  expect(rir).toHaveValue('5')
  await user.type(rir, '0')
  expect(rir).toHaveValue('0')
  await user.type(rir, 'x')
  expect(rir).toHaveValue('0')
  await user.type(rir, '3')
  expect(rir).toHaveValue('3')
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith({ weight: 105, reps: 10, rir: 3, side: null })
})

test('a set without a rep count (or past 100) is not logged — the old number field\'s own bounds', async () => {
  const user = userEvent.setup()
  const { props } = renderCard()
  await user.clear(repsField())
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  await user.type(repsField(), '0')
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).not.toHaveBeenCalled()
  // Only digits are kept, three at most.
  await user.clear(repsField())
  await user.type(repsField(), '1a2,5')
  expect(repsField()).toHaveValue('125')
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).not.toHaveBeenCalled()
  await user.clear(repsField())
  await user.type(repsField(), '100')
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith(expect.objectContaining({ reps: 100 }))
})

test('the ✓ submits the typed values, RIR included', async () => {
  const user = userEvent.setup()
  const { props } = renderCard()
  await user.clear(kgField())
  await user.type(kgField(), '60')
  await user.clear(repsField())
  await user.type(repsField(), '7')
  await user.clear(rirField())
  await user.type(rirField(), '1')
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith({ weight: 60, reps: 7, rir: 1, side: null })
})

test('Enter in a field submits the row like the ✓', async () => {
  const user = userEvent.setup()
  const { props } = renderCard()
  await user.type(repsField(), '{Enter}')
  expect(props.onLogSet).toHaveBeenCalledWith({ weight: 105, reps: 10, rir: 2, side: null })
})

test('the cursor lands on the SECOND working slot once the first is logged', async () => {
  const user = userEvent.setup()
  let session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, id: 's0' })
  const { props } = renderCard({ session })
  await user.click(screen.getByRole('button', { name: '2. szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith({ weight: 105, reps: 10, rir: 2, side: null })
})

test('an isolation exercise offers the side picker (Bal / Mindkettő / Jobb → L / B / R), and it rides the log payload', async () => {
  const user = userEvent.setup()
  const exercise = makeExercise({ type: 'isolation', warmupSets: 0, workingSets: 1, sets: 1, prescribedSets: [PRESCRIBED[2]] })
  const { props } = renderCard({ exercise })
  const sides = within(screen.getByRole('group', { name: 'Oldal' }))
  await user.click(sides.getByRole('button', { name: 'Bal' }))
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenLastCalledWith(expect.objectContaining({ side: 'L' }))
  await user.click(sides.getByRole('button', { name: 'Jobb' }))
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenLastCalledWith(expect.objectContaining({ side: 'R' }))
  await user.click(sides.getByRole('button', { name: 'Mindkettő' }))
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenLastCalledWith(expect.objectContaining({ side: 'B' }))
  // Tapping the pressed one clears it.
  await user.click(sides.getByRole('button', { name: 'Mindkettő' }))
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenLastCalledWith(expect.objectContaining({ side: null }))
})

test('a done row\'s mark fires onTapDoneRow', async () => {
  const user = userEvent.setup()
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, id: 'srv-1' })
  const { props } = renderCard({ session })
  const done = screen.getByRole('group', { name: '1. szett · kész' })
  expect([...done.querySelectorAll('.v')].map((c) => c.textContent)).toEqual(['105', '10', '2'])
  await user.click(screen.getByRole('button', { name: '1. szett szerkesztése · célsávban' }))
  expect(props.onTapDoneRow).toHaveBeenCalledWith(0)
})

test('a done row whose server id has not landed yet is NOT tappable and says it is saving (mezo-l3on)', () => {
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, localId: 'loc-1' })
  const { container } = renderCard({ session, busy: true })
  const mark = screen.getByRole('button', { name: '1. szett szerkesztése · mentés folyamatban' })
  expect(mark).toBeDisabled()
  expect(mark).toHaveAttribute('aria-busy', 'true')
  expect(container.querySelector('.ek-hero')).toHaveAttribute('aria-busy', 'true')
})

test('a done row whose POST is KNOWN to have failed is tappable again (mezo-l3on F1)', () => {
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, localId: 'loc-1' })
  renderCard({ session, failedLocalIds: new Set(['loc-1']) })
  expect(screen.getByRole('button', { name: /1\. szett szerkesztése/ })).toBeEnabled()
})

test('a RECORD medal takes the done row\'s mark over; a TARGET-tier medal does not', () => {
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, id: 'srv-1' })
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, id: 'srv-2' })
  renderCard({
    session,
    medalsBySetIdx: {
      0: [{ type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Chest Supported Row', setIndex: 0 } as never, { type: 'E1RM', tier: 'RECORD', exerciseName: 'Chest Supported Row', setIndex: 0 } as never],
      1: [{ type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Chest Supported Row', setIndex: 1 } as never],
    },
  })
  const record = screen.getByRole('button', { name: '1. szett szerkesztése · rekord' })
  expect(record.querySelectorAll('use')).toHaveLength(1)
  expect(record.querySelector('use')!.getAttribute('href')).toBe('#t-record')
  expect(screen.getByRole('button', { name: '2. szett szerkesztése · célsávban' })).toBeInTheDocument()
})

test('a skipped exercise shows its state instead of the grid', () => {
  const session = skipExercise(
    makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }]),
    'ex1',
  )
  const { container } = renderCard({ session })
  expect(container.querySelector('.ek-hero')).toHaveAttribute('data-state', 'skipped')
  expect(screen.getByText('Állapot')).toBeInTheDocument()
  expect(screen.getByText('kihagyva · a már naplózott szettjeid megmaradnak')).toBeInTheDocument()
  expect(container.querySelector('.ex-sets')).toBeNull()
  // The menu stays: that is where it is taken back.
  expect(screen.getByRole('button', { name: 'Chest Supported Row · további műveletek' })).toBeInTheDocument()
})

test('an all-logged exercise is marked done and offers no editable row', () => {
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 0, workingSets: 1, prescribedSets: [PRESCRIBED[2]] }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, id: 'srv-1' })
  const { container } = renderCard({ session })
  expect(container.querySelector('.ek-hero')).toHaveAttribute('data-state', 'done')
  expect(container.querySelectorAll('.ex-sets > form.r')).toHaveLength(0)
})

test('a failed start: the ✓ is dead and nothing is logged', async () => {
  const user = userEvent.setup()
  const { props } = renderCard({ logBlocked: true })
  expect(screen.getByRole('button', { name: '1. szett mentése' })).toBeDisabled()
  await user.type(repsField(), '{Enter}')
  expect(props.onLogSet).not.toHaveBeenCalled()
})

test('a plyo exercise logs weightKg 0 and has no weight to type', async () => {
  const user = userEvent.setup()
  const exercise = makeExercise({ type: 'plyo', warmupSets: 0, workingSets: 2, sets: 2, prescribedSets: [PRESCRIBED[2], PRESCRIBED[3]] })
  const { props } = renderCard({ exercise })
  expect(kgField()).toBeDisabled()
  expect(kgField()).toHaveValue('—')
  expect(screen.getByRole('group', { name: '2. szett · terv' })).toHaveTextContent('—')
  expect(screen.queryByText(/kg-hoz igazítva/)).toBeNull()
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenCalledWith(expect.objectContaining({ weight: 0 }))
})

test('changing the kg recomputes the reps at equivalent effort and says so (mezo-l95v4)', async () => {
  const user = userEvent.setup()
  const { container } = renderCard()
  await user.clear(kgField())
  await user.type(kgField(), '100')
  expect(repsField()).toHaveValue('12')
  expect(container.querySelector('.ex-adj')).toHaveTextContent('100 kg-hoz igazítva · ajánlás 105 × 10')
})

test('typed reps win until the kg changes again; back to target restores it', async () => {
  const user = userEvent.setup()
  const { container } = renderCard()
  await user.clear(kgField())
  await user.type(kgField(), '100')
  await user.clear(repsField())
  await user.type(repsField(), '14')
  expect(repsField()).toHaveValue('14')
  await user.clear(kgField())
  await user.type(kgField(), '105')
  expect(repsField()).toHaveValue('10')
  expect(container.querySelector('.ex-adj')).toBeNull()
})

test('the later rows follow the swapped weight with the equivalent reps', async () => {
  const user = userEvent.setup()
  renderCard()
  await user.clear(kgField())
  await user.type(kgField(), '102.5')
  const later = screen.getByRole('group', { name: '2. szett · terv' })
  expect(later).toHaveTextContent('102,5')
  expect(later).toHaveTextContent('11')
  expect(later).not.toHaveTextContent('8–10')
})

test('the next set prefills the carried weight with equivalent reps, and the verdict shifts', () => {
  const exercise = makeExercise()
  let session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 100, reps: 11, rir: 2, id: 's0' })
  renderCard({ exercise, session })
  expect(kgField()).toHaveValue('100')
  expect(repsField()).toHaveValue('12')
  // 11 reps at 100 kg sits inside the shifted 10–12 range, not "above" 8–10.
  expect(screen.getByRole('button', { name: '1. szett szerkesztése · célsávban' })).toBeInTheDocument()
})

test('the kg field takes the HU decimal comma and a dot alike, unrounded (mezo-py1i6)', async () => {
  const user = userEvent.setup()
  const { props } = renderCard()
  const kg = kgField()
  await user.clear(kg)
  await user.type(kg, '102,5')
  expect(kg).toHaveValue('102,5')
  expect(repsField()).toHaveValue('11')
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenLastCalledWith({ weight: 102.5, reps: 11, rir: 2, side: null })
})

test('a dot works too, and a quarter-kilo stays exact', async () => {
  const user = userEvent.setup()
  const { props } = renderCard()
  const kg = kgField()
  await user.clear(kg)
  await user.type(kg, '101.25')
  expect(kg).toHaveValue('101.25')
  await user.click(screen.getByRole('button', { name: '1. szett mentése' }))
  expect(props.onLogSet).toHaveBeenLastCalledWith(expect.objectContaining({ weight: 101.25 }))
})

// ---- where the exercise came from (mezo-mobji), in the new wording ----

test.each([
  [{ changeScope: 'TODAY', replacesName: 'Lat Pulldown' }, 'Csak ma · a Lat Pulldown helyett'],
  [{ changeScope: 'MESO', replacesName: 'Lat Pulldown' }, 'A tervben is · a Lat Pulldown helyett'],
  [{ changeScope: 'TODAY' }, 'Ma hozzáadva'],
  [{ changeScope: 'MESO' }, 'Felvéve a tervbe'],
] as const)('a swapped-in / added exercise says where it came from: %o → „%s"', (over, text) => {
  renderCard({ exercise: makeExercise(over as Partial<LoggedWorkoutExercise>) })
  expect(screen.getByText(text).closest('.ex-xl')).not.toBeNull()
})

test('a swapped-in exercise never done before says who picks the first weight', () => {
  renderCard({ exercise: makeExercise({ changeScope: 'TODAY', replacesName: 'Lat Pulldown', lastWeek: null, rationale: undefined }) })
  expect(screen.getByText('Első alkalom')).toBeInTheDocument()
  expect(screen.getByText('a súlyt te adod meg, innentől jön a javaslat')).toBeInTheDocument()
})

test('a swapped-OUT exercise keeps its logged sets, says where the rest went, and has no menu and no Technika', () => {
  const exercise = makeExercise({ replacedByName: 'T-Bar Row' })
  let session: Session = makeSession([{ id: 'ex1', warmupSets: 0, workingSets: 1, prescribedSets: [PRESCRIBED[2]] }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, id: 'srv-1' })
  const { container } = renderCard({ exercise, session, onOpenVideo: vi.fn() })
  expect(container.querySelector('.ek-hero')).toHaveAttribute('data-state', 'swapped')
  expect(screen.getByText('lecserélve → T-Bar Row · 1 szett kész')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /további műveletek$/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Technika' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Chest Supported Row · előzmények és rekordok' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /szett szerkesztése/ })).toHaveLength(1)
})

// ---- WorkoutRow: an exercise that is not on top ----

function renderRow(over: Partial<React.ComponentProps<typeof WorkoutRow>> = {}) {
  const exercise = over.exercise ?? makeExercise()
  const session = over.session ?? makeSession([
    { id: exercise.id, warmupSets: exercise.warmupSets, workingSets: exercise.workingSets, prescribedSets: exercise.prescribedSets },
  ])
  const props = { exercise, session, tag: null, onFocus: vi.fn(), ...over }
  return { ...render(<MemoryRouter><WorkoutRow {...props} /></MemoryRouter>), props }
}

test('row: the name, the sets and the goal, the vs-last-week chip, one capsule per set — and a tap brings it on top', async () => {
  const user = userEvent.setup()
  let session = makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }])
  session = completeSet(session, 'ex1', { weight: 105, reps: 10, rir: 2, id: 's0' })
  const { props } = renderRow({ session, tag: 'now', exercise: makeExercise({
    progression: { lever: 'weight', deltaKg: 2.5, deltaReps: null, targetWeightKg: 105, targetReps: 10, rationale: 'x' },
  }) })
  const row = screen.getByRole('button')
  expect(row).toHaveClass('ek-row')
  expect(row).toHaveAttribute('data-state', 'now')
  expect(row).toHaveTextContent('Chest Supported Row')
  expect(row).toHaveTextContent('3 szett · cél 105 × 10')
  expect(row.querySelector('.ex-dchip')).toHaveTextContent('+2,5 kg')
  expect(within(row).getByText('Most')).toHaveClass('fo-st', 'plan')
  const caps = within(row).getByRole('img', { name: '1 / 3 szett kész' })
  expect([...caps.querySelectorAll('i')].map((i) => i.className)).toEqual(['f', 'h', ''])
  await user.click(row)
  expect(props.onFocus).toHaveBeenCalled()
})

test('row: the pills — Kész, Kihagyva; a skipped and a swapped-out exercise are quiet and say so', () => {
  const done = renderRow({ tag: 'done' })
  expect(screen.getByText('Kész')).toHaveClass('fo-st', 'ok')
  done.unmount()
  const session = skipExercise(makeSession([{ id: 'ex1', warmupSets: 2, workingSets: 3, prescribedSets: PRESCRIBED }]), 'ex1')
  const skipped = renderRow({ session, tag: 'skipped' })
  expect(screen.getByRole('button')).toHaveClass('dim')
  expect(screen.getByRole('button')).toHaveAttribute('data-state', 'skipped')
  expect(screen.getByRole('button')).toHaveTextContent('kihagyva')
  expect(screen.getByText('Kihagyva')).toHaveClass('fo-st', 'q')
  skipped.unmount()
  renderRow({ exercise: makeExercise({ replacedByName: 'T-Bar Row' }), tag: null })
  expect(screen.getByRole('button')).toHaveClass('dim')
  expect(screen.getByRole('button')).toHaveTextContent('lecserélve → T-Bar Row · 0 szett kész')
  expect(screen.getByRole('button').querySelector('.fo-st')).toBeNull()
})

test('exerciseGoal: the first working prescription, else the engine\'s target; a plyo reads its reps; nothing → null', () => {
  expect(exerciseGoal(makeExercise())).toBe('105 × 10')
  expect(exerciseGoal(makeExercise({ prescribedSets: undefined, progression: { lever: 'weight', deltaKg: 2.5, deltaReps: null, targetWeightKg: 72.5, targetReps: 9, rationale: 'x' } }))).toBe('72,5 × 9')
  expect(exerciseGoal(makeExercise({ type: 'plyo' }))).toBe('10 ism.')
  expect(exerciseGoal(makeExercise({ prescribedSets: undefined }))).toBeNull()
})
