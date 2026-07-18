import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderHero = (utilities?: React.ReactNode) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/today']}>
        <AppHero utilities={utilities} />
      </MemoryRouter>
    </QueryWrapper>,
  )

test('renders identity, level badge, equipped title and the label-less counters', () => {
  renderHero()
  expect(screen.getByText('Daniel')).toBeInTheDocument()
  expect(screen.getByText('A Fegyelmezett')).toBeInTheDocument()
  expect(screen.getByLabelText('Szint 12 — Growth')).toBeInTheDocument()
  expect(screen.getByText('🔥 6')).toBeInTheDocument()
  expect(screen.getByText('⚡ 1/3')).toBeInTheDocument() // mockQuestDay: 1 of 3 completed
  expect(screen.getByText('🪙 240')).toBeInTheDocument()
})

test('counters keep the full Hungarian wording for screen readers', () => {
  renderHero()
  expect(screen.getByLabelText('6 napos sorozat')).toBeInTheDocument()
  expect(screen.getByLabelText('1/3 napi quest')).toBeInTheDocument()
  expect(screen.getByLabelText('240 érme')).toBeInTheDocument()
})

test('single row: the chips band is gone, counters live inside .apphero', () => {
  const { container } = renderHero()
  expect(container.querySelector('.apphero-chips')).toBeNull()
  expect(container.querySelector('.apphero .counters')).toBeInTheDocument()
})

test('renders the per-tab utilities slot', () => {
  renderHero(<button aria-label="Keresés" />)
  expect(screen.getByLabelText('Keresés')).toBeInTheDocument()
})

test('🔥 opens the StreakSheet, 🪙 opens the TitleShopSheet', async () => {
  renderHero()
  await userEvent.click(screen.getByLabelText('6 napos sorozat'))
  expect(await screen.findByText('🔥 6 napos sorozat')).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  await userEvent.click(screen.getByLabelText('240 érme'))
  expect(await screen.findByText('Title-ök')).toBeInTheDocument()
})

test('avatar links to /me, level badge and quest counter link to /me/growth', () => {
  renderHero()
  expect(screen.getByLabelText('Profil')).toHaveAttribute('href', '/me')
  expect(screen.getByLabelText('Szint 12 — Growth')).toHaveAttribute('href', '/me/growth')
  expect(screen.getByLabelText('1/3 napi quest')).toHaveAttribute('href', '/me/growth')
})
