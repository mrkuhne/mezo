import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GrowthPage } from '@/features/me/pages/GrowthPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { progressionProfileMock } from '@/data/progression/progressionMock'
import { mockQuestDay, mockQuestHistory } from '@/data/quest/questMock'
import { mockActivities, mockActivityHistory } from '@/data/activity/activityMock'
import { achievementsMock } from '@/data/progression/achievementsMock'

// Barrel-mock the hooks the page (and, since Task 7, the DailyQuestsCard + ActivityLogCard
// it mounts in the "Ma" block) read, so the fixtures drive the view deterministically in
// both mock and real test modes.
const hooks = vi.hoisted(() => ({
  useProgressionProfile: vi.fn(),
  useQuestHistory: vi.fn(),
  useActivityHistory: vi.fn(),
  useAchievements: vi.fn(),
  useDailyQuests: vi.fn(),
  useQuestActions: vi.fn(),
  useActivities: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useProgressionProfile: hooks.useProgressionProfile,
  useQuestHistory: hooks.useQuestHistory,
  useActivityHistory: hooks.useActivityHistory,
  useAchievements: hooks.useAchievements,
  useDailyQuests: hooks.useDailyQuests,
  useQuestActions: hooks.useQuestActions,
  useActivities: hooks.useActivities,
}))

// Pin "today" to 2026-07-12 so the mock quest/activity dates (Júl 10–11) yield
// deterministic Tegnap/Júl labels in the journal regardless of the wall clock.
vi.mock('@/shared/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/dates')>()),
  localDateString: () => '2026-07-12',
}))

function renderPage() {
  // LevelUpProvider mirrors production (mounted once in AppLayout) — the "Ma" block's
  // DailyQuestsCard requires it (Task 7 relocation).
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={['/me/growth']}>
          <GrowthPage />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

beforeEach(() => {
  hooks.useProgressionProfile.mockReturnValue({ data: progressionProfileMock })
  hooks.useQuestHistory.mockReturnValue({ data: mockQuestHistory })
  hooks.useActivityHistory.mockReturnValue({ data: mockActivityHistory })
  hooks.useAchievements.mockReturnValue({ data: achievementsMock })
  hooks.useDailyQuests.mockReturnValue({ quests: mockQuestDay, levelUps: [], rerollsLeft: 1, mode: 'mock' })
  hooks.useQuestActions.mockReturnValue({ reroll: vi.fn(), pending: false, consumeLevelUps: vi.fn() })
  hooks.useActivities.mockReturnValue({ data: mockActivities, isPending: false })
})
afterEach(() => vi.clearAllMocks())

test('renders the Growth header', () => {
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Growth' })).toBeInTheDocument()
})

test('hero trio shows the FE-summed Össz XP, Fegyelem and Ritmus', () => {
  renderPage()
  // Össz XP = Σ cumulativeXp across life (1085) + athletic (9350) + muscle (8550) = 18985.
  expect(screen.getByText('18 985')).toBeInTheDocument()
  expect(screen.getByText('Össz XP')).toBeInTheDocument()
  expect(screen.getByText('78%')).toBeInTheDocument() // traits.disciplinePct
  expect(screen.getByText('5 hét')).toBeInTheDocument() // traits.consistencyWeeks
})

test('default Skillek tab lists all three bands, one .progress-mrow per skill', () => {
  const { container } = renderPage()
  expect(screen.getByText('LIFE')).toBeInTheDocument()
  expect(screen.getByText('Atlétikus')).toBeInTheDocument()
  expect(screen.getByText('Izom')).toBeInTheDocument()
  // One row per skill across the three bands. The seed has 8 LIFE + 12 athletic
  // (robustness is the 12th, mirroring the backend) + 13 muscle = 33 rows.
  const expected =
    progressionProfileMock.life.length +
    progressionProfileMock.athletic.length +
    progressionProfileMock.muscle.length
  expect(expected).toBe(33)
  expect(container.querySelectorAll('.progress-mrow')).toHaveLength(expected)
})

test('the "Ma" block mounts the quests card + activity log card at the top of Skillek (Task 7 relocation)', () => {
  renderPage()
  expect(screen.getByText('Ma')).toBeInTheDocument()
  expect(screen.getByText('Napi küldetések')).toBeInTheDocument()
  expect(screen.getByText('A mai tervezett edzés a naptárban van — csináld végig')).toBeInTheDocument()
  expect(screen.getByText('Tevékenységnapló')).toBeInTheDocument()
  expect(screen.getByText('Olvastam 30 percet a Psychology of Money-ból')).toBeInTheDocument()
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
