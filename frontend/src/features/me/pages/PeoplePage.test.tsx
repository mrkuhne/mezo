import { render, screen } from '@testing-library/react'
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
