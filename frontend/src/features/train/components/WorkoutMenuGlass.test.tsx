import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Challenge, LoggedWorkoutExercise } from '@/data/types'
import { ChallengeDetailGlass, WorkoutMenuGlass, WorkoutVideoGlass, noteHint } from '@/features/train/components/WorkoutMenuGlass'
import { challengeTypeLabel } from '@/features/train/logic/challengeDisplay'

// WorkoutMenuGlass — the exercise's menu of the active workout. Since Folyadék F4 (mezo-n4wf5.4) a light sheet
// (prototype vilagos/edzes.js `menu`): Videó (only with a demo url) · Jegyzet · Szett hozzáadása · Szett elvétele ·
// Előrébb · Hátrébb · Gyakorlat cseréje (only with onSwap) · Gyakorlat kihagyása / Visszavesszük, under the
// exercise's sets drawn as capsules.

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
  expect(screen.getByText('most 5 szett van')).toBeInTheDocument()
})

test('Szett hozzáadása is disabled once the exercise is skipped', () => {
  render(<WorkoutMenuGlass {...baseProps()} skipped />)
  expect(screen.getByText('Szett hozzáadása').closest('button')).toBeDisabled()
})

test('the note hint toggles between the first-note and the edit copy', () => {
  expect(noteHint(false)).toBe('ami a következő alkalomra számít')
  expect(noteHint(true)).toBe('a megírt jegyzet szerkesztése')
})

test('Jegyzet fires onEditNote and closes the glass', async () => {
  const user = userEvent.setup()
  const props = baseProps()
  render(<WorkoutMenuGlass {...props} hasNote />)
  expect(screen.getByText('a megírt jegyzet szerkesztése')).toBeInTheDocument()
  await user.click(screen.getByText('Jegyzet'))
  expect(props.onEditNote).toHaveBeenCalledOnce()
  expect(props.onClose).toHaveBeenCalledOnce()
})

test('it is a light sheet named after the exercise, with the context line, the muscle and the set count', () => {
  render(<WorkoutMenuGlass {...baseProps()} exercise={{ ...EX, muscle: 'back-mid' }} />)
  const dialog = screen.getByRole('dialog', { name: 'Chest Supported Row' })
  expect(dialog).toHaveClass('fo-sheet')
  expect(within(dialog).getByRole('heading', { name: 'Chest Supported Row' })).toBeInTheDocument()
  expect(within(dialog).getByText('Gyakorlat')).toBeInTheDocument()
  expect(within(dialog).getByText(/^5 szett · /)).toBeInTheDocument()
  // no dressing of the retired glass skin
  expect(dialog.querySelector('[class*="wo-"], [class*="wos-"], [class*="gl-"]')).toBeNull()
})

test('the sets stand as capsules: the logged ones full, the next one half, and the line says how many are done', () => {
  render(<WorkoutMenuGlass {...baseProps()} slotCount={4} loggedCount={2} />)
  const caps = document.querySelector('.fo-shg .fo-caps') as HTMLElement
  expect(caps.querySelectorAll('i')).toHaveLength(4)
  expect(caps.querySelectorAll('i.f')).toHaveLength(2)
  expect(caps.querySelectorAll('i.h')).toHaveLength(1)
  expect(screen.getByText('2 / 4 szett kész')).toBeInTheDocument()
})

test('a skipped exercise: the line reads kihagyva and no capsule is the current one', () => {
  render(<WorkoutMenuGlass {...baseProps()} slotCount={4} loggedCount={1} skipped />)
  expect(screen.getByText('kihagyva')).toBeInTheDocument()
  expect(document.querySelectorAll('.fo-shg .fo-caps i.h')).toHaveLength(0)
})

test('Gyakorlat cseréje is offered only with onSwap; its hint names the sets that stay', async () => {
  const user = userEvent.setup()
  const props = baseProps()
  const onSwap = vi.fn()
  const { rerender } = render(<WorkoutMenuGlass {...props} />)
  expect(screen.queryByText('Gyakorlat cseréje')).not.toBeInTheDocument()
  rerender(<WorkoutMenuGlass {...props} onSwap={onSwap} />)
  expect(screen.getByText('hasonlóra vagy bármi másra')).toBeInTheDocument()
  rerender(<WorkoutMenuGlass {...props} onSwap={onSwap} loggedCount={2} />)
  expect(screen.getByText('a 2 kész szett itt marad, a többi az újé')).toBeInTheDocument()
  await user.click(screen.getByText('Gyakorlat cseréje'))
  expect(onSwap).toHaveBeenCalledOnce()
  expect(props.onClose).toHaveBeenCalledOnce()
})

test('Szett hozzáadása / elvétele fire their handlers and close', async () => {
  const user = userEvent.setup()
  const props = baseProps()
  render(<WorkoutMenuGlass {...props} />)
  await user.click(screen.getByText('Szett hozzáadása'))
  expect(props.onAddSet).toHaveBeenCalledOnce()
  await user.click(screen.getByText('Szett elvétele'))
  expect(props.onRemoveSet).toHaveBeenCalledOnce()
  expect(props.onClose).toHaveBeenCalledTimes(2)
})

test('closed: renders nothing', () => {
  const { container } = render(<WorkoutMenuGlass {...baseProps()} open={false} />)
  expect(container).toBeEmptyDOMElement()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('the skip row wears the danger tone, the take-back row does not', () => {
  const { rerender } = render(<WorkoutMenuGlass {...baseProps()} />)
  expect(screen.getByText('Gyakorlat kihagyása').closest('button')).toHaveClass('bad')
  expect(screen.getByText('a már naplózott szettjeid megmaradnak')).toBeInTheDocument()
  rerender(<WorkoutMenuGlass {...baseProps()} skipped />)
  expect(screen.getByText('Visszavesszük').closest('button')).not.toHaveClass('bad')
  expect(screen.getByText('újra bekerül a mai munkába')).toBeInTheDocument()
})

// ---- WorkoutVideoGlass — the video sheet: the embed in its frame, or the empty state ----

test('renders nothing when closed', () => {
  const { container } = render(
    <WorkoutVideoGlass open={false} exercise={null} tint="#fff" onClose={() => {}} />,
  )
  expect(container).toBeEmptyDOMElement()
})

test('embeds a recognized YouTube demo url inside the frame', () => {
  render(
    <WorkoutVideoGlass
      open
      exercise={{ ...EX, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }}
      tint="#fff"
      onClose={() => {}}
    />,
  )
  expect(screen.getByRole('dialog', { name: 'Chest Supported Row · videó' })).toHaveClass('fo-sheet')
  const frame = document.querySelector('.el-vid') as HTMLElement
  expect(frame).not.toBeNull()
  const iframe = within(frame).getByTitle('Demo videó') as HTMLIFrameElement
  expect(iframe.src).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
})

test('no demo url -> the frame renders the empty-state copy, not an iframe', () => {
  render(<WorkoutVideoGlass open exercise={EX} tint="#fff" onClose={() => {}} />)
  const frame = document.querySelector('.el-vid') as HTMLElement
  expect(within(frame).queryByTitle('Demo videó')).not.toBeInTheDocument()
  expect(within(frame).getByText('Nincs elérhető videó')).toBeInTheDocument()
})

// ── The menu lost its Küldetések row (mezo-mgu2r): picking lives on the briefing ──
test('the menu carries no Küldetések row any more', () => {
  render(<WorkoutMenuGlass {...baseProps()} />)
  expect(screen.queryByText('Küldetések')).not.toBeInTheDocument()
})

// ── ChallengeDetailGlass · the quest's sheet: release / take back (mezo-mgu2r) ──
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
  const dialog = screen.getByRole('dialog', { name: `${challengeTypeLabel(CHALLENGE.typeLabel)} küldetés` })
  expect(dialog).toHaveClass('fo-sheet')
  expect(within(dialog).getByText('Küldetés · vállalva')).toBeInTheDocument()
  expect(within(dialog).getByText('Chest Supported Row')).toBeInTheDocument()
  expect(screen.getByText('107,5 kg × 8')).toBeInTheDocument()
  expect(screen.getByText('72% biztos · alacsony kockázat')).toBeInTheDocument()
  // how sure it is, as a level
  expect((dialog.querySelector('.fo-level > i') as HTMLElement).style.width).toBe('72%')
  expect(screen.getByText('jó formában vagy')).toBeInTheDocument()
  expect(screen.getByText(/Büntetés nélkül/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Elengedem' }))
  expect(p.onToggle).toHaveBeenCalledTimes(1)
  expect(p.onClose).toHaveBeenCalled()
})

test('detail glass · a released challenge offers Visszaveszem', () => {
  render(<ChallengeDetailGlass {...detailProps({ state: 'released' })} />)
  expect(screen.getByRole('button', { name: 'Visszaveszem' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Elengedem' })).not.toBeInTheDocument()
  expect(screen.getByText('Küldetés · elengedve')).toBeInTheDocument()
  expect(screen.getByText(/Most nem számít bele a zárásba/)).toBeInTheDocument()
})

test('detail glass · a resolved challenge shows its outcome and no action', () => {
  render(<ChallengeDetailGlass {...detailProps({ state: 'hit', challenge: { ...CHALLENGE, status: 'hit', outcome: '108 × 8 lett' } })} />)
  expect(screen.getByText('108 × 8 lett')).toBeInTheDocument()
  expect(screen.getByText('Teljesült.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Elengedem|Visszaveszem/ })).not.toBeInTheDocument()
})

test.each([
  ['miss' as const, 'Most nem jött össze — semmi gond.'],
  ['inconclusive' as const, 'Ebből nem tudtuk eldönteni.'],
])('detail glass · a %s quest reads its outcome line and offers no action', (state, line) => {
  render(<ChallengeDetailGlass {...detailProps({ state })} />)
  expect(screen.getByText(line)).toBeInTheDocument()
  expect(screen.getByText('Küldetés')).toBeInTheDocument()
  // no recorded outcome text -> the reasoning stays
  expect(screen.getByText('jó formában vagy')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Elengedem|Visszaveszem/ })).not.toBeInTheDocument()
})

test('detail glass · a quest still being learned has no level, and a free-text target keeps its pieces', () => {
  render(<ChallengeDetailGlass {...detailProps({ challenge: { ...CHALLENGE, confidence: null, target: 'Utolsó szet RIR 0-ig' } })} />)
  expect(document.querySelector('.fo-level')).toBeNull()
  expect(screen.getByText('RIR 0 · utolsó szett')).toBeInTheDocument()
})

test('detail glass · closed or without a quest renders nothing', () => {
  const { container, rerender } = render(<ChallengeDetailGlass {...detailProps({ open: false })} />)
  expect(container).toBeEmptyDOMElement()
  rerender(<ChallengeDetailGlass {...detailProps({ challenge: null })} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
