import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Challenge, LoggedWorkoutExercise } from '@/data/types'
import { WorkoutChallengesGlass, WorkoutMenuGlass, WorkoutVideoGlass, challengeHint, noteHint } from '@/features/train/components/WorkoutMenuGlass'

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
    acceptedChallenges: 1,
    totalChallenges: 3,
    challengesPending: false,
    onClose: vi.fn(),
    onVideo: vi.fn(),
    onChallenges: vi.fn(),
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

// ── Küldetések row (mezo-e1ii9): accept/dismiss's new home, opened from the header ⋯ ──
test('the Küldetések row opens the challenges glass WITHOUT closing the menu itself', async () => {
  const user = userEvent.setup()
  const p = baseProps()
  render(<WorkoutMenuGlass {...p} />)
  await user.click(screen.getByText('Küldetések'))
  expect(p.onChallenges).toHaveBeenCalled()
  expect(p.onClose).not.toHaveBeenCalled()
})

test('challengeHint: pending -> készül, empty -> the honest line, else accepted/total', () => {
  expect(challengeHint(true, 0, 0)).toMatch(/készülnek/)
  expect(challengeHint(false, 0, 0)).toBe('Ma nincs kihívás')
  expect(challengeHint(false, 1, 3)).toBe('1/3 elfogadva')
})

// ── WorkoutChallengesGlass · the three-state guard (mezo-e1ii9 fix round 1) ──
// The retired PrepKuldetesekPage.test.tsx covered all three states; the glass inherited
// the priority (pending → honest-empty → list) but only the loaded path had cover. The
// priority IS the mezo-hbwi silent-gap fix: "still generating" must never be shown as
// "ma nincs kihívás", so the pending branch has to win over an empty list.
const CHALLENGE: Challenge = {
  id: 'c1', type: 'PR', typeLabel: 'PR-kísérlet', exerciseId: 'e-1', exercise: 'Chest Supported Row',
  target: '80 kg × 5', risk: 'low', why: 'jó formában vagy', refs: [], glory: 'új csúcs',
}

function challengeProps(over: Partial<React.ComponentProps<typeof WorkoutChallengesGlass>> = {}) {
  return {
    open: true,
    challenges: [CHALLENGE],
    accepted: {} as Record<string, boolean>,
    onToggle: vi.fn(),
    pending: false,
    tint: '#abcdef',
    onClose: vi.fn(),
    ...over,
  }
}

test('challenges glass · pending: the generation loader wins, and NEVER the honest-empty line', () => {
  render(<WorkoutChallengesGlass {...challengeProps({ challenges: [], pending: true })} />)
  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.getByText(/A mai küldetések · készül…/)).toBeInTheDocument()
  expect(screen.queryByText('Ma nincs kihívás')).not.toBeInTheDocument()
})

test('challenges glass · resolved empty: the honest-empty line, no loader, 0/0', () => {
  render(<WorkoutChallengesGlass {...challengeProps({ challenges: [], pending: false })} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('Ma nincs kihívás')).toBeInTheDocument()
  expect(screen.getByText(/A mai küldetések · 0\/0 elfogadva/)).toBeInTheDocument()
})

test('challenges glass · loaded: the cards render, loader gone, real accepted count', () => {
  render(<WorkoutChallengesGlass {...challengeProps({ accepted: { c1: true } })} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByText('Ma nincs kihívás')).not.toBeInTheDocument()
  expect(screen.getByText(/A mai küldetések · 1\/1 elfogadva/)).toBeInTheDocument()
  expect(screen.getByText(/PR-kísérlet/)).toBeInTheDocument()
})
