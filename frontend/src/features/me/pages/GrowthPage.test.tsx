import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GrowthPage } from '@/features/me/pages/GrowthPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { progressionProfileMock } from '@/data/progression/progressionMock'

// Barrel-mock the one hook the page reads (sibling-page pattern) so the fixture
// drives the view deterministically in both mock and real test modes.
const hooks = vi.hoisted(() => ({ useProgressionProfile: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useProgressionProfile: hooks.useProgressionProfile,
}))

function renderPage() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/growth']}>
        <GrowthPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

beforeEach(() => {
  hooks.useProgressionProfile.mockReturnValue({ data: progressionProfileMock })
})
afterEach(() => vi.clearAllMocks())

test('renders the Growth header', () => {
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Growth' })).toBeInTheDocument()
})

test('hero trio shows the FE-summed Össz XP, Fegyelem and Ritmus', () => {
  renderPage()
  // Össz XP = Σ cumulativeXp across life (1085) + athletic (7500) + muscle (8550) = 17135.
  expect(screen.getByText('17 135')).toBeInTheDocument()
  expect(screen.getByText('Össz XP')).toBeInTheDocument()
  expect(screen.getByText('78%')).toBeInTheDocument() // traits.disciplinePct
  expect(screen.getByText('5 hét')).toBeInTheDocument() // traits.consistencyWeeks
})

test('default Skillek tab lists all three bands, one .progress-mrow per skill', () => {
  const { container } = renderPage()
  expect(screen.getByText('LIFE')).toBeInTheDocument()
  expect(screen.getByText('Atlétikus')).toBeInTheDocument()
  expect(screen.getByText('Izom')).toBeInTheDocument()
  // One row per skill across the three bands. The seed has 8 LIFE + 11 athletic
  // (robustness is not in the fixture) + 13 muscle = 32 rows.
  const expected =
    progressionProfileMock.life.length +
    progressionProfileMock.athletic.length +
    progressionProfileMock.muscle.length
  expect(expected).toBe(32)
  expect(container.querySelectorAll('.progress-mrow')).toHaveLength(expected)
})

test('LIFE band renders the 30-day savings footer', () => {
  renderPage()
  expect(screen.getByText('Megtakarítás (30 nap)')).toBeInTheDocument()
  expect(screen.getByText('50 000 Ft')).toBeInTheDocument()
})

test('switching to Napló hides the skill bands', async () => {
  const { container } = renderPage()
  expect(container.querySelectorAll('.progress-mrow').length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('tab', { name: 'Napló' }))
  expect(container.querySelectorAll('.progress-mrow')).toHaveLength(0)
  expect(screen.queryByText('LIFE')).not.toBeInTheDocument()
})
