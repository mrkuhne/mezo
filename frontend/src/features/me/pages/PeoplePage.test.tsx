import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryWrapper } from '@/test/queryWrapper'
import { PeoplePage } from '@/features/me/pages/PeoplePage'

// usePeople is dual-mode since Slice E — pin the mock seed for the Phase-1 parity assertions.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderPage = () => render(<PeoplePage />, { wrapper: QueryWrapper })

test('renders the Kapcsolatok header', () => {
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: /Kapcsolatok/ })).toBeInTheDocument()
  expect(screen.getByText('Me · Emberek')).toBeInTheDocument()
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
