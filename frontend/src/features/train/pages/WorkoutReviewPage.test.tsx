import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WorkoutReviewPage } from '@/features/train/pages/WorkoutReviewPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { FrameProvider, useFrame } from '@/shared/ui/folyadek'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

/** What the page hands the app frame — the title bar's text and its back handler. */
function FrameProbe() {
  const { title, eyebrow, onBack } = useFrame()
  return <button type="button" data-testid="frame-title" data-eyebrow={eyebrow} onClick={onBack}>{title}</button>
}

function setup(id = 'wd-mock-1') {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/review/${id}`]}>
        <FrameProvider>
          <FrameProbe />
          <Routes>
            <Route path="/train/review/:workoutId" element={<WorkoutReviewPage />} />
            <Route path="/train" element={<p>edzések</p>} />
          </Routes>
        </FrameProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}
const exList = () => document.querySelector('.eo-exlist') as HTMLElement
const openExercise = (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
  user.click(within(exList()).getByRole('button', { name }))

test('renders the closed report from the workout detail (mock fixture)', () => {
  setup()
  // The title bar: „Összegzés", with the closing day and the workout's name above it.
  expect(screen.getByTestId('frame-title')).toHaveTextContent('Összegzés')
  expect(screen.getByTestId('frame-title').getAttribute('data-eyebrow')).toMatch(/^Lezárva · .+ · Pull Day$/)
  // The hero: one sentence with done / planned sets and the tonnes, then plan and measured minutes.
  expect(screen.getByText('Kész · Pull Day')).toBeInTheDocument()
  expect(document.querySelector('.eo-num')!.textContent).toBe('3 szett a 6-ból, 1,9 tonna összvolumen.')
  expect(screen.getByText(/1\/2 gyakorlat · terv ~62, tény 71 perc/)).toBeInTheDocument()
  // One tube per exercise; the abandoned one is an empty vessel that says so.
  const tubes = document.querySelector('.eo-extubes') as HTMLElement
  expect(tubes.querySelectorAll('.fo-vial')).toHaveLength(2)
  expect(within(tubes).getByText('kihagyva')).toBeInTheDocument()
  // The inventory is a row per exercise, one anchor number each.
  const lane = exList()
  expect(within(lane).getByText('Chest Supported Row')).toBeInTheDocument()
  expect(lane.querySelector('.eo-exrow .eo-best')!.textContent).toMatch(/85\s*×\s*8/)
  // The abandoned exercise reads "kihagyva · nincs szett" on its row.
  expect(within(lane).getByText('kihagyva · nincs szett')).toBeInTheDocument()
  // The honesty line, said once.
  expect(screen.getByText(/Az összegzés sosem büntet/)).toBeInTheDocument()
  // No finish CTA in review. The workout note is REAL (mezo-d20.8.2.2): the seeded fixture
  // carries one, so it reads back here — and it is read-only until „Szerkesztés" is used.
  expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
  expect(document.querySelector('textarea')).toBeNull()
  expect(screen.getByText('Amit aznap írtál')).toBeInTheDocument()
  expect(screen.getByText(/Öt órát aludtam/)).toBeInTheDocument()
})

test('the closing note is editable in place, and an empty one offers + Jegyzet', async () => {
  setup()
  await userEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
  // In place: the card stays where it was, the field replaces the sentence.
  expect(screen.getByText('Amit aznap írtál')).toBeInTheDocument()
  const field = screen.getByLabelText('Hogy ment?') as HTMLTextAreaElement
  expect(field.value).toMatch(/Öt órát aludtam/)

  await userEvent.clear(field)
  await userEvent.type(field, 'Átírva utólag.')
  await userEvent.click(screen.getByRole('button', { name: 'Mentés' }))

  // Mock mode writes the detail cache rather than no-oping — a note the user just typed must
  // not vanish while the UI pretends it saved.
  expect(await screen.findByText('Átírva utólag.')).toBeInTheDocument()

  // Clearing it lands on the honest empty state: no placeholder, but a way to fill the gap.
  await userEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
  await userEvent.clear(screen.getByLabelText('Hogy ment?'))
  await userEvent.click(screen.getByRole('button', { name: 'Mentés' }))
  expect(await screen.findByRole('button', { name: /Jegyzet ehhez az edzéshez/ })).toBeInTheDocument()
})

// mezo-e1ii9 Task 3: the closing ceremony no longer carries the küldetés rows (the prototype
// has none on either of its two steps). This page is their ONE remaining home, so it is
// pinned here — removing the strip from the ceremony must never leave the outcomes homeless.
test('the challenge outcomes live here — the review page is their remaining home', () => {
  setup()
  const rows = document.querySelectorAll('.eo-quest')
  expect(rows.length).toBeGreaterThan(0)
  expect(screen.getByText(/^Küldetések · \d+ megvan · \d+ kimaradt$/)).toBeInTheDocument()
  // Every row ends in its outcome pill; the mock's quests were never taken — quiet, not failed.
  rows.forEach((r) => expect(r.querySelector('.fo-st')).not.toBeNull())
  expect(screen.getAllByText('nem vállaltad').length).toBe(rows.length)
})

test('renders the Medálok section with the seeded medal in mock mode', () => {
  setup()
  expect(screen.getByText('Medálok · 1 rekord · 1 célszett')).toBeInTheDocument()
  const section = document.querySelector('.eo-medals') as HTMLElement
  expect(within(section).getByText(/^Súly-rekord · előző:/)).toBeInTheDocument()
  expect(within(section).getByText('Chest Supported Row')).toBeInTheDocument()
  expect(within(section).getByText('1 célszett teljesítve')).toBeInTheDocument()
  // setIndex 2 lands on a real logged set, so the exercise's row earns the Rekord tag.
  const row = within(exList()).getByRole('button', { name: /Chest Supported Row/ })
  expect(within(row).getByText('Rekord')).toBeInTheDocument()
})

describe('the comparison („az előzőhöz mérve")', () => {
  const cell = (key: string) => document.querySelector(`.eo-cmp[data-cell="${key}"]`) as HTMLElement

  test('names the reference and its distance from THIS session, not from today', () => {
    setup()
    expect(screen.getByText('A számok · az előzőhöz mérve')).toBeInTheDocument()
    const ref = document.querySelector('.eo-cmp-ref') as HTMLElement
    expect(ref.textContent).toMatch(/^Mihez képest: az előző Pull Day, .+ \(2 héttel korábban\)\./)
    // Each of the three rows says what the value WAS.
    expect(within(cell('volume')).getByText(/t volt/)).toBeInTheDocument()
    expect(within(cell('target')).getByText(/volt/)).toBeInTheDocument()
    expect(within(cell('rir')).getByText(/volt · itt a kevesebb a nehezebb/)).toBeInTheDocument()
    // …and the hero's tubes carry the previous instance as a dashed line.
    expect(document.querySelectorAll('.eo-extubes .wl').length).toBeGreaterThan(0)
  })

  test('tones only what rose — a lighter week stays neutral (ADR 0010)', () => {
    setup()
    // The reference is heavier, so volume went DOWN: signed honestly, coloured neutrally.
    const volume = cell('volume')
    expect(volume.querySelector('.v')!.textContent).toMatch(/^−/)
    expect(volume.classList.contains('up')).toBe(false)
    // The target medal is on THIS session only → +1, the one direction the palette tones.
    const target = cell('target')
    expect(target.querySelector('.v')!.textContent).toBe('+1')
    expect(target.classList.contains('up')).toBe(true)
    // Both draw today as the level and the value then as the line.
    expect(volume.querySelector('.fo-wlv')).not.toBeNull()
    expect(target.querySelector('.fo-wlv')).not.toBeNull()
  })

  test('never tones Ø RIR, in either direction', () => {
    setup()
    expect(cell('rir').classList.contains('up')).toBe(false)
    expect(cell('rir').querySelector('.fo-wlv')).toBeNull()
  })

  test('does not render at all for the first instance of a template day', () => {
    // wd-mock-first opens the chain: nothing precedes it, so there is nothing to compare
    // against — and no placeholder standing in for the absence.
    setup('wd-mock-first')
    expect(document.querySelector('.eo-cmp')).toBeNull()
    expect(document.querySelector('.eo-cmp-ref')).toBeNull()
    expect(screen.getByText('A számok')).toBeInTheDocument()
    // No reference → no dashed line on any tube either.
    expect(document.querySelectorAll('.eo-extubes .wl')).toHaveLength(0)
  })
})

describe('stepping along the template-day chain', () => {
  test('offers the neighbours, and disables the end of the chain rather than hiding it', () => {
    setup()
    const nav = document.querySelector('.eo-stepnav') as HTMLElement
    const [prev, next] = [...nav.querySelectorAll('button')]
    expect(prev).not.toBeDisabled()
    expect(within(prev).getByText(/Előző Pull Day/)).toBeInTheDocument()
    expect(next).toBeDisabled()
    expect(within(next).getByText('ez a legutóbbi')).toBeInTheDocument()
  })

  test('the first instance has no earlier one: that end is disabled, the next is offered', () => {
    setup('wd-mock-first')
    const [prev, next] = [...document.querySelectorAll<HTMLButtonElement>('.eo-stepnav button')]
    expect(prev).toBeDisabled()
    expect(within(prev).getByText('nincs korábbi')).toBeInTheDocument()
    expect(next).not.toBeDisabled()
    expect(within(next).getByText(/Következő Pull Day/)).toBeInTheDocument()
  })
})

describe('the exercise view', () => {
  test('opens from an exercise row and gives every set its own row', async () => {
    const user = userEvent.setup()
    setup()
    await openExercise(user, /Chest Supported Row/)

    // The title bar now names the exercise; its back closes the view instead of leaving the page.
    expect(screen.getByTestId('frame-title')).toHaveTextContent('Chest Supported Row')
    expect(screen.getByTestId('frame-title')).toHaveAttribute('data-eyebrow', 'Összegzés · Hát (közép) · Pull Day')
    expect(screen.getByText('85 × 8 — 5 kg-mal több, mint legutóbb.')).toBeInTheDocument()
    expect(screen.getByText('3/3 szett · cél 6–9 ism.')).toBeInTheDocument()

    const sets = [...document.querySelectorAll('.eo-set')]
    // This instance was recorded BEFORE the warm-up ruling (mezo-i8ahy), so it really does
    // carry one logged warm-up — the report keeps showing it, numbered B, while the PLAN it
    // is measured against is the 3 working sets. 1 warmup + 2 working = every planned slot
    // accounted for, so no ghost row.
    expect(sets).toHaveLength(3)
    expect(sets.map((x) => x.getAttribute('data-ix'))).toEqual(['B', '1', '2'])
    // The warm-up is not drawn in the prototype but stays: a quiet row that says what it is.
    expect(sets[0].className).toContain('warm')
    expect(within(sets[0] as HTMLElement).getByText('bemelegítő')).toBeInTheDocument()
    expect(within(sets[0] as HTMLElement).getByText('600 kg')).toBeInTheDocument()
    // The band label is what makes a set readable: not just what you lifted, but whether it counted.
    expect(within(sets[1] as HTMLElement).getByText('célsávban')).toBeInTheDocument()
    expect(sets[1].textContent).toContain('1. szett')
    expect(sets[1].textContent).toContain('80 kg × 8 · RIR 2')
    // One tube per set in the hero, the goal as the dashed line on the working ones.
    expect(document.querySelectorAll('.eo-settubes .fo-vial')).toHaveLength(3)
    expect(document.querySelectorAll('.eo-settubes .wl')).toHaveLength(2)

    await user.click(screen.getByTestId('frame-title'))
    expect(screen.getByTestId('frame-title')).toHaveTextContent('Összegzés')
    expect(exList()).toBeInTheDocument()
  })

  test('an abandoned exercise shows its planned sets as dim „kimaradt" rows', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(within(document.querySelector('.eo-extubes') as HTMLElement).getByRole('button', { name: /Lat Pulldown/ }))
    const ghosts = [...document.querySelectorAll('.eo-set.eo-ghost')]
    expect(ghosts).toHaveLength(3)
    expect(ghosts[0].className).toContain('dim')
    expect(ghosts[0].textContent).toContain('1. szett — kimaradt')
    expect(document.querySelectorAll('.eo-settubes .fo-vial.ghost')).toHaveLength(3)
  })

  test('a workout that logged every working set reads complete, not partial', async () => {
    const user = userEvent.setup()
    setup()
    await openExercise(user, /Chest Supported Row/)
    expect(document.querySelector('.eo-set.eo-ghost')).toBeNull()
  })

  test('carries the reference top set, under the same gate as the comparison tile', async () => {
    const user = userEvent.setup()
    setup()
    await openExercise(user, /Chest Supported Row/)
    const strip = document.querySelector('.eo-nums') as HTMLElement
    expect(within(strip).getByText('előzőleg')).toBeInTheDocument()
    expect(within(strip).getByText('top szett')).toBeInTheDocument()
    expect(within(strip).getByText('kg volumen')).toBeInTheDocument()
    expect(within(strip).getByText('Ø RIR')).toBeInTheDocument()
  })

  test('drops the "Előzőleg" cell when the chain has no reference', async () => {
    const user = userEvent.setup()
    setup('wd-mock-first')
    await openExercise(user, /Chest Supported Row/)
    const strip = document.querySelector('.eo-nums') as HTMLElement
    expect(within(strip).queryByText('előzőleg')).toBeNull()
    expect(strip.querySelectorAll('.fo-facts > div')).toHaveLength(3)
    expect(screen.getByText(/volt a legnehezebb szetted\.$/)).toBeInTheDocument()
  })
})
