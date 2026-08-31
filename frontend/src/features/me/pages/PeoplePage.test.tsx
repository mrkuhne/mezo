import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { PeoplePage } from '@/features/me/pages/PeoplePage'

// usePeople is dual-mode since Slice E — pin the mock seed for the Phase-1 parity assertions.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderPage = () =>
  render(
    <MemoryRouter>
      <PeoplePage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

// mezo-d20.11 (ADR 0032): the prototype's own header — the `‹ Én` back chip + the `🎤 Log`
// page action — plus the page-hero, replacing the .pghead-np band that offered no way back.
test('renders the Mozaik header, the way back and the active-circle hero', () => {
  const { container } = renderPage()
  expect(screen.getByText('Kapcsolatok')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Vissza' })).toBeInTheDocument()
  expect(screen.getByText('‹ Én')).toBeInTheDocument()
  expect(container.querySelector('.mz-bignum')?.textContent).toBe('5')
  expect(screen.getByText('aktív kör · tap → részletek')).toBeInTheDocument()
  expect(container.querySelector('.pghead-np')).toBeNull()
})

test('renders all five people in the active circle', () => {
  renderPage()
  for (const name of ['Petra', 'Bence', 'Ádám', 'Réka', 'Márk']) {
    expect(screen.getAllByText(name).length).toBeGreaterThan(0)
  }
})

test('mentions feed "Jelölt" filter narrows to flagged mentions', async () => {
  renderPage()
  await userEvent.click(screen.getByText('Jelölt'))
  expect(screen.getAllByText('Réka').length).toBeGreaterThan(0)
})

// Mozaik re-face (mezo-d20.6.7): person tiles are the washed 2-col .ppl-tile —
// not the old Napiv row-card — and each carries an affect-ring avatar.
test('renders person tiles as the washed 2-col mosaic grid', () => {
  const { container } = renderPage()
  expect(container.querySelector('.ppl-grid')).toBeInTheDocument()
  const tiles = container.querySelectorAll('.ppl-tile')
  expect(tiles.length).toBe(5)
})

// FIGYELEM + the `kapcsolódik` pattern-tie chip: a flagged mention with a tie must show
// both, verbatim (Réka's seeded mention carries both — see data/me/people.ts).
test('a flagged mention with a pattern tie shows FIGYELEM and the kapcsolódik chip', () => {
  const { container } = renderPage()
  expect(screen.getAllByText('FIGYELEM').length).toBeGreaterThan(0)
  const tile = screen.getByText('Hangjegy · 22:18').closest('.ppl-mrowt')
  expect(tile).not.toBeNull()
  const { getByText } = within(tile as HTMLElement)
  expect(getByText('kapcsolódik')).toBeInTheDocument()
  expect(getByText('FIGYELEM')).toBeInTheDocument()
  expect(container.querySelectorAll('.ppl-mrowt').length).toBeGreaterThan(0)
})

// mezo-06o0.1: automata (text/chat-sourced) mentions carry an undo control; chip-sourced
// (manual log) mentions never do — undoing only makes sense for the ones the extractor wrote.
test('the automata mention shows an undo button that removes it; chip-sourced mentions have none', async () => {
  renderPage()
  const autoTile = screen.getByText(/Ádámmal átbeszéltük a hétvégi túrát\./).closest('.ppl-mrowt') as HTMLElement
  const undoBtn = within(autoTile).getByRole('button', { name: 'Említés visszavonása' })
  expect(undoBtn).toBeInTheDocument()

  const chipTile = screen.getByText(/Bence-vel röpi után/).closest('.ppl-mrowt') as HTMLElement
  expect(within(chipTile).queryByRole('button', { name: 'Említés visszavonása' })).toBeNull()

  await userEvent.click(undoBtn)
  await waitFor(() => {
    expect(screen.queryByText(/Ádámmal átbeszéltük a hétvégi túrát\./)).toBeNull()
  })
})

// mezo-d20.11: the filter row wears the prototype's own .fchip shape (#page-emberek .chiprow),
// not the generic .chip with inline overrides — and every `.rise` sits inside the armed
// `.mz-play` group (a `.rise` outside it renders correctly but never animates).
test('the filter row is the prototype .fchip row and no .rise sits outside the EntranceGroup', () => {
  const { container } = renderPage()
  const chips = container.querySelectorAll('.ppl-chiprow .ppl-fchip')
  expect(chips).toHaveLength(3)
  expect(container.querySelector('.ppl-fchip.on')?.textContent).toBe('Mind')

  const play = container.querySelector('.mz-play')
  expect(play).not.toBeNull()
  const rises = container.querySelectorAll('.rise')
  expect(rises.length).toBeGreaterThan(0)
  for (const el of rises) expect(play!.contains(el)).toBe(true)
})
