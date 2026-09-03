import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WorkoutReviewPage } from '@/features/train/pages/WorkoutReviewPage'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup(id = 'wd-mock-1') {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/review/${id}`]}>
        <Routes>
          <Route path="/train/review/:workoutId" element={<WorkoutReviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('renders the closed report from the workout detail (mock fixture)', () => {
  setup()
  expect(screen.getByText('Pull Day')).toBeInTheDocument()
  expect(screen.getByText('Lezárva ·', { exact: false })).toBeInTheDocument()
  // The inventory is a swimlane of exercise tiles, one anchor number each.
  const lane = document.querySelector('.wr-lane') as HTMLElement
  expect(within(lane).getByText('Chest Supported Row')).toBeInTheDocument()
  expect(lane.querySelector('.wr-extile .top')!.textContent).toMatch(/85\s*×\s*8/)
  // The abandoned exercise reads "nincs szett" on its tile.
  expect(within(lane).getByText('nincs szett')).toBeInTheDocument()
  // No finish CTA in review. The workout note is now REAL (mezo-d20.8.2.2): the seeded fixture
  // carries one, so it reads back here — and it is read-only until the ✎ is used.
  expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
  expect(document.querySelector('textarea')).toBeNull()
  expect(screen.getByText('Amit aznap írtál')).toBeInTheDocument()
  expect(screen.getByText(/Öt órát aludtam/)).toBeInTheDocument()
})

test('the closing note is editable in place, and an empty one offers ＋ Jegyzet', async () => {
  setup()
  await userEvent.click(screen.getByRole('button', { name: 'Jegyzet szerkesztése' }))
  const field = screen.getByLabelText('Hogy ment?') as HTMLTextAreaElement
  expect(field.value).toMatch(/Öt órát aludtam/)

  await userEvent.clear(field)
  await userEvent.type(field, 'Átírva utólag.')
  await userEvent.click(screen.getByRole('button', { name: 'Mentés' }))

  // Mock mode writes the detail cache rather than no-oping — a note the user just typed must
  // not vanish while the UI pretends it saved.
  expect(await screen.findByText('Átírva utólag.')).toBeInTheDocument()

  // Clearing it lands on the honest empty state: no placeholder, but a way to fill the gap.
  await userEvent.click(screen.getByRole('button', { name: 'Jegyzet szerkesztése' }))
  await userEvent.clear(screen.getByLabelText('Hogy ment?'))
  await userEvent.click(screen.getByRole('button', { name: 'Mentés' }))
  expect(await screen.findByRole('button', { name: /Jegyzet ehhez az edzéshez/ })).toBeInTheDocument()
})

test('renders the Medálok section with the seeded medal in mock mode', () => {
  setup()
  const section = screen.getByText('Medálok').closest('.wsum-sec') as HTMLElement
  expect(within(section).getByText('Súly-rekord')).toBeInTheDocument()
  expect(within(section).getByText('Chest Supported Row')).toBeInTheDocument()
  // setIndex 2 lands on a real logged set, so the exercise's tile earns the REKORD stamp.
  const tile = screen.getByRole('button', { name: /Chest Supported Row/ })
  expect(within(tile).getByText('REKORD')).toBeInTheDocument()
})

describe('the „Mihez képest" tile', () => {
  test('names the reference and its distance from THIS session, not from today', () => {
    setup()
    const cmp = document.querySelector('.wr-cmp') as HTMLElement
    expect(within(cmp).getByText(/Előző Pull Day/)).toBeInTheDocument()
    expect(within(cmp).getByText('2 héttel korábban')).toBeInTheDocument()
  })

  test('tones only what rose — a lighter week stays neutral (ADR 0010)', () => {
    setup()
    const cells = [...document.querySelectorAll('.wr-cmp-cell')]
    const byLabel = (l: string) => cells.find((c) => c.querySelector('.l')?.textContent === l)!
    // The reference is heavier, so volume went DOWN: signed honestly, coloured neutrally.
    const volume = byLabel('volumen')
    expect(volume.querySelector('.v')!.textContent).toMatch(/^−/)
    expect(volume.querySelector('.v')!.className).not.toContain('up')
    // The target medal is on THIS session only → +1, the one direction the palette tones.
    const target = byLabel('célszett')
    expect(target.querySelector('.v')!.textContent).toBe('+1')
    expect(target.querySelector('.v')!.className).toContain('up')
  })

  test('never tones Ø RIR, in either direction', () => {
    setup()
    const rir = [...document.querySelectorAll('.wr-cmp-cell')]
      .find((c) => c.querySelector('.l')?.textContent === 'Ø RIR')!
    expect(rir.querySelector('.v')!.className).not.toContain('up')
  })

  test('does not render at all for the first instance of a template day', () => {
    // wd-mock-first opens the chain: nothing precedes it, so there is nothing to compare
    // against — and no placeholder standing in for the absence.
    setup('wd-mock-first')
    expect(document.querySelector('.wr-cmp')).toBeNull()
  })
})

describe('stepping along the template-day chain', () => {
  test('offers the neighbours, and disables the end of the chain rather than hiding it', () => {
    setup()
    const nav = document.querySelector('.wr-stepnav') as HTMLElement
    const [prev, next] = [...nav.querySelectorAll('button')]
    expect(prev).not.toBeDisabled()
    expect(within(prev).getByText(/Előző Pull Day/)).toBeInTheDocument()
    expect(next).toBeDisabled()
    expect(within(next).getByText('ez a legutóbbi')).toBeInTheDocument()
  })
})

describe('the exercise view', () => {
  test('opens from a swimlane tile and gives every set its own row', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /Chest Supported Row/ }))

    const sets = [...document.querySelectorAll('.wr-set')]
    // 2 logged working sets + 1 warmup + 2 ghost rows for the unlogged slots.
    expect(sets).toHaveLength(5)
    // The warmup is numbered B, so the working sets stay 1..n on their own.
    expect(sets[0].querySelector('.ix')!.textContent).toBe('B')
    expect(sets[1].querySelector('.ix')!.textContent).toBe('1')
    // The band label is what makes a set readable: not just what you lifted, but whether it counted.
    expect(within(sets[1] as HTMLElement).getByText('célsávban')).toBeInTheDocument()
    // A missed slot is a ghost, never an error — and it continues the WORKING numbering, so
    // the column reads B · 1 · 2 · 3 · 4 rather than jumping to 4 over a logged warmup.
    expect(sets.map((x) => x.querySelector('.ix')!.textContent)).toEqual(['B', '1', '2', '3', '4'])
    expect(sets[4].className).toContain('ghost')
    expect(within(sets[4] as HTMLElement).getByText('— kimaradt')).toBeInTheDocument()
  })

  test('carries the reference top set, under the same gate as the comparison tile', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /Chest Supported Row/ }))
    const strip = document.querySelector('.mz-statstrip') as HTMLElement
    expect(within(strip).getByText('Előzőleg')).toBeInTheDocument()
  })

  test('drops the "Előzőleg" cell when the chain has no reference', async () => {
    const user = userEvent.setup()
    setup('wd-mock-first')
    await user.click(screen.getByRole('button', { name: /Chest Supported Row/ }))
    const strip = document.querySelector('.mz-statstrip') as HTMLElement
    expect(within(strip).queryByText('Előzőleg')).toBeNull()
  })
})
