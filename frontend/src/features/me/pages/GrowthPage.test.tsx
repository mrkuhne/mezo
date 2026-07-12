import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GrowthPage } from '@/features/me/pages/GrowthPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { progressionProfileMock } from '@/data/progression/progressionMock'
import { mockQuestHistory } from '@/data/quest/questMock'
import { mockActivityHistory } from '@/data/activity/activityMock'
import { achievementsMock } from '@/data/progression/achievementsMock'

// Barrel-mock the hooks the page reads (sibling-page pattern) so the fixtures
// drive the view deterministically in both mock and real test modes.
const hooks = vi.hoisted(() => ({
  useProgressionProfile: vi.fn(),
  useQuestHistory: vi.fn(),
  useActivityHistory: vi.fn(),
  useAchievements: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useProgressionProfile: hooks.useProgressionProfile,
  useQuestHistory: hooks.useQuestHistory,
  useActivityHistory: hooks.useActivityHistory,
  useAchievements: hooks.useAchievements,
}))

// Pin "today" to 2026-07-12 so the mock quest/activity dates (Júl 10–11) yield
// deterministic Tegnap/Júl labels in the journal regardless of the wall clock.
vi.mock('@/shared/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/dates')>()),
  localDateString: () => '2026-07-12',
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
  hooks.useQuestHistory.mockReturnValue({ data: mockQuestHistory })
  hooks.useActivityHistory.mockReturnValue({ data: mockActivityHistory })
  hooks.useAchievements.mockReturnValue({ data: achievementsMock })
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

test('Napló tab renders the day-grouped journal from the mock seeds', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('tab', { name: 'Napló' }))
  // With today pinned to 2026-07-12, the 2026-07-11 rows group under "Tegnap".
  expect(screen.getByText('Tegnap')).toBeInTheDocument()
  expect(screen.getByText('A mai tervezett edzés a naptárban van — csináld végig')).toBeInTheDocument()
  // qh3 is expired (still surfaced, muted) → "csendben lejárt".
  expect(screen.getByText(/csendben lejárt/)).toBeInTheDocument()
  // summary chip: 3 completed · 1 expired · 4 activities.
  expect(screen.getByText('3 ✓ · 1 — · 4 ✎')).toBeInTheDocument()
})

test('Kitüntetések tab renders both the Badges and Perks cards', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('tab', { name: 'Kitüntetések' }))
  expect(screen.getByText('Badge-ek')).toBeInTheDocument()
  expect(screen.getByText('4 / 9 megszerezve')).toBeInTheDocument()
  expect(screen.getByText('Perkek — mérföldkövek')).toBeInTheDocument()
  expect(screen.getByText('3 feloldva')).toBeInTheDocument()
})
