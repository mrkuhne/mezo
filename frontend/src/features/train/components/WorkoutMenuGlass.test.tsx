import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Challenge, LoggedWorkoutExercise } from '@/data/types'
import { ChallengeDetailGlass, WorkoutMenuGlass, WorkoutVideoGlass, noteHint } from '@/features/train/components/WorkoutMenuGlass'

// WorkoutMenuGlass (mezo-88iwa.7, T6 Task 4) — the per-card ⋮ menu, GlassBox-hosted.
// Ports the prototype's `menuGlass` (session.js:101-126) row-for-row: Videó (only with
// a demo url) · Jegyzet · Szett hozzáadása · Szett elvétele · Előrébb · Hátrébb ·
// Gyakorlat kihagyása / Visszavesszük.

const EX: LoggedWorkoutExercise = {
  id: 'e-1', name: 'Chest Supported Row', warmupSets: 2, workingSets: 3,
  repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null, type: 'compound',
  muscle: 'back', sets: 5, prescribedSets: null, rationale: null, lastWeek: null,
}

function baseProps() {
  return {
    open: true,
    exercise: EX,
    tint: '#abcdef',
    position: 1,
    orderLength: 5,
    slotCount: 5,
    skipped: false,
    hasNote: false,
    canRemoveTrailingSet: true,
    onClose: vi.fn(),
    onVideo: vi.fn(),
    onEditNote: vi.fn(),
    onAddSet: vi.fn(),
    onRemoveSet: vi.fn(),
    onMoveEarlier: vi.fn(),
    onMoveLater: vi.fn(),
    onToggleSkip: vi.fn(),
  }
}

test('no videoUrl -> no Videó row', () => {
  render(<WorkoutMenuGlass {...baseProps()} />)
  expect(screen.queryByText('Videó')).not.toBeInTheDocument()
})

test('a videoUrl -> the Videó row renders and opens the video glass without closing the menu itself', async () => {
  const user = userEvent.setup()
  const props = baseProps()
  render(<WorkoutMenuGlass {...props} exercise={{ ...EX, videoUrl: 'https://youtu.be/abc12345678' }} />)
  await user.click(screen.getByText('Videó'))
  expect(props.onVideo).toHaveBeenCalledOnce()
  // Videó switches the page to the OTHER glass — it must not also fire onClose
  // (that would race the page's own state update, see the component's header note).
  expect(props.onClose).not.toHaveBeenCalled()
})

test('the first exercise in session order disables Előrébb', () => {
  render(<WorkoutMenuGlass {...baseProps()} position={0} />)
  expect(screen.getByText('Előrébb').closest('button')).toBeDisabled()
  expect(screen.getByText('Hátrébb').closest('button')).not.toBeDisabled()
})

test('the last exercise in session order disables Hátrébb', () => {
  render(<WorkoutMenuGlass {...baseProps()} position={4} orderLength={5} />)
  expect(screen.getByText('Hátrébb').closest('button')).toBeDisabled()
  expect(screen.getByText('Előrébb').closest('button')).not.toBeDisabled()
})

test('a one-slot exercise disables Szett elvétele', () => {
  render(<WorkoutMenuGlass {...baseProps()} canRemoveTrailingSet={false} />)
  expect(screen.getByText('Szett elvétele').closest('button')).toBeDisabled()
})

test('Hátrébb moves the card and closes the glass', async () => {
  const user = userEvent.setup()
  const props = baseProps()
  render(<WorkoutMenuGlass {...props} />)
  await user.click(screen.getByText('Hátrébb'))
  expect(props.onMoveLater).toHaveBeenCalledOnce()
  expect(props.onClose).toHaveBeenCalledOnce()
})

test('Előrébb moves the card and closes the glass', async () => {
  const user = userEvent.setup()
  const props = baseProps()
  render(<WorkoutMenuGlass {...props} />)
  await user.click(screen.getByText('Előrébb'))
  expect(props.onMoveEarlier).toHaveBeenCalledOnce()
  expect(props.onClose).toHaveBeenCalledOnce()
})

test('Kihagyás flips to Visszavesszük once the exercise is skipped', () => {
  const { rerender } = render(<WorkoutMenuGlass {...baseProps()} skipped={false} />)
  expect(screen.getByText('Gyakorlat kihagyása')).toBeInTheDocument()
  expect(screen.queryByText('Visszavesszük')).not.toBeInTheDocument()
  rerender(<WorkoutMenuGlass {...baseProps()} skipped />)
  expect(screen.getByText('Visszavesszük')).toBeInTheDocument()
  expect(screen.queryByText('Gyakorlat kihagyása')).not.toBeInTheDocument()
})

test('tapping Gyakorlat kihagyása fires onToggleSkip and closes the glass', async () => {
  const user = userEvent.setup()
  const props = baseProps()
  render(<WorkoutMenuGlass {...props} />)
  await user.click(screen.getByText('Gyakorlat kihagyása'))
  expect(props.onToggleSkip).toHaveBeenCalledOnce()
  expect(props.onClose).toHaveBeenCalledOnce()
})

test('Szett hozzáadása\'s hint carries the current slot count', () => {
  render(<WorkoutMenuGlass {...baseProps()} slotCount={5} />)
  expect(screen.getByText('Most 5 szett van')).toBeInTheDocument()
})

test('Szett hozzáadása is disabled once the exercise is skipped', () => {
  render(<WorkoutMenuGlass {...baseProps()} skipped />)
  expect(screen.getByText('Szett hozzáadása').closest('button')).toBeDisabled()
})

test('the note hint toggles between the first-note and the edit copy', () => {
  expect(noteHint(false)).toBe('Ami a következő alkalomra számít')
  expect(noteHint(true)).toBe('Megírt jegyzet szerkesztése')
})

test('Jegyzet fires onEditNote and closes the glass', async () => {
  const user = userEvent.setup()
  const props = baseProps()
  render(<WorkoutMenuGlass {...props} hasNote />)
  expect(screen.getByText('Megírt jegyzet szerkesztése')).toBeInTheDocument()
  await user.click(screen.getByText('Jegyzet'))
  expect(props.onEditNote).toHaveBeenCalledOnce()
  expect(props.onClose).toHaveBeenCalledOnce()
})

test('the label + tint reach the underlying GlassBox dialog', () => {
  render(<WorkoutMenuGlass {...baseProps()} />)
  const dialog = screen.getByRole('dialog', { name: 'Chest Supported Row' })
  expect(within(dialog).getByText('Chest Supported Row')).toBeInTheDocument()
})

// ---- WorkoutVideoGlass — the minimal `.wo-video-frame` embed ----

test('renders nothing when closed', () => {
  const { container } = render(
    <WorkoutVideoGlass open={false} exercise={null} tint="#fff" onClose={() => {}} />,
  )
  expect(container).toBeEmptyDOMElement()
})

test('embeds a recognized YouTube demo url inside .wo-video-frame', () => {
  render(
    <WorkoutVideoGlass
      open
      exercise={{ ...EX, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }}
      tint="#fff"
      onClose={() => {}}
    />,
  )
  const frame = document.querySelector('.wo-video-frame') as HTMLElement
  expect(frame).not.toBeNull()
  const iframe = within(frame).getByTitle('Demo videó') as HTMLIFrameElement
  expect(iframe.src).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
})

test('no demo url -> the frame renders the empty-state copy, not an iframe', () => {
  render(<WorkoutVideoGlass open exercise={EX} tint="#fff" onClose={() => {}} />)
  const frame = document.querySelector('.wo-video-frame') as HTMLElement
  expect(within(frame).queryByTitle('Demo videó')).not.toBeInTheDocument()
  expect(within(frame).getByText('Nincs elérhető videó')).toBeInTheDocument()
})

// ── The menu lost its Küldetések row (mezo-mgu2r): picking lives on the briefing ──
test('the menu carries no Küldetések row any more', () => {
  render(<WorkoutMenuGlass {...baseProps()} />)
  expect(screen.queryByText('Küldetések')).not.toBeInTheDocument()
})

// ── ChallengeDetailGlass · a card badge's glass: release / take back (mezo-mgu2r) ──
const CHALLENGE: Challenge = {
  id: 'c1', type: 'PR', typeLabel: 'PR-attempt', exerciseId: 'e-1', exercise: 'Chest Supported Row',
  target: '107.5 kg × 8', confidence: 0.72, risk: 'low', why: 'jó formában vagy', refs: [], glory: 'új csúcs',
}

function detailProps(over: Partial<React.ComponentProps<typeof ChallengeDetailGlass>> = {}) {
  return { open: true, challenge: CHALLENGE, state: 'accepted' as const, tint: '#abcdef', onToggle: vi.fn(), onClose: vi.fn(), ...over }
}

test('detail glass · an accepted challenge reads its target and offers Elengedem', async () => {
  const user = userEvent.setup()
  const p = detailProps()
  render(<ChallengeDetailGlass {...p} />)
  expect(screen.getByRole('dialog', { name: 'PR-kísérlet küldetés' })).toBeInTheDocument()
  expect(screen.getByText('107,5 kg')).toBeInTheDocument()
  expect(screen.getByText('72% biztos · alacsony kockázat')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Elengedem' }))
  expect(p.onToggle).toHaveBeenCalledTimes(1)
  expect(p.onClose).toHaveBeenCalled()
})

test('detail glass · a released challenge offers Visszaveszem', () => {
  render(<ChallengeDetailGlass {...detailProps({ state: 'released' })} />)
  expect(screen.getByRole('button', { name: 'Visszaveszem' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Elengedem' })).not.toBeInTheDocument()
})

test('detail glass · a resolved challenge shows its outcome and no action', () => {
  render(<ChallengeDetailGlass {...detailProps({ state: 'hit', challenge: { ...CHALLENGE, status: 'hit', outcome: '108 × 8 lett' } })} />)
  expect(screen.getByText('108 × 8 lett')).toBeInTheDocument()
  expect(screen.getByText('Teljesült.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Elengedem|Visszaveszem/ })).not.toBeInTheDocument()
})
