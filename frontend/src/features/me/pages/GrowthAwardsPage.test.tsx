import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GrowthAwardsPage } from '@/features/me/pages/GrowthAwardsPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { progressionProfileMock } from '@/data/progression/progressionMock'
import { gamificationProfileMock } from '@/data/gamification/gamificationMock'
import { achievementsMock } from '@/data/progression/achievementsMock'
import { TITLE_CATALOG } from '@/data/gamification/titleCatalog'

const hooks = vi.hoisted(() => ({
  useAchievements: vi.fn(),
  useProgressionProfile: vi.fn(),
  useGamification: vi.fn(),
  useTitles: vi.fn(),
  useGamificationActions: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/hooks')>()), ...hooks }))

function renderPage() {
  return render(
    <QueryWrapper>
      <MemoryRouter>
        <GrowthAwardsPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

beforeEach(() => {
  hooks.useAchievements.mockReturnValue({ data: achievementsMock })
  hooks.useProgressionProfile.mockReturnValue({ data: progressionProfileMock })
  hooks.useGamification.mockReturnValue({ profile: gamificationProfileMock, isPending: false })
  hooks.useTitles.mockReturnValue({
    titles: TITLE_CATALOG.map((t) => ({
      ...t,
      owned: t.kind === 'LADDER' ? (t.unlockLevel ?? 1) <= 12 : false,
      equipped: t.key === 'kovetkezetes',
    })),
  })
  hooks.useGamificationActions.mockReturnValue({ buyTitle: vi.fn(), equipTitle: vi.fn(), buyStreakSaver: vi.fn(), canMutate: true })
})
afterEach(() => vi.clearAllMocks())

test('hero 4 / 9 jelvény; streak card, titles, badge grid and perks in one EntranceGroup; ‹ Growth', () => {
  const { container } = renderPage()
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Growth')
  expect(screen.getByText('/ 9 jelvény')).toBeInTheDocument()
  expect(screen.getByTestId('streak-card')).toBeInTheDocument()
  expect(screen.getByTestId('titles-section')).toBeInTheDocument()
  expect(container.querySelectorAll('.gr-bdg')).toHaveLength(9)
  expect(screen.getByText('Perkek')).toBeInTheDocument()
  for (const r of container.querySelectorAll('.rise')) expect(r.closest('.mz-play')).not.toBeNull()
})

test('locked ladder titles read LV n-TŐL, not a lock emoji', () => {
  renderPage()
  expect(screen.getAllByText(/^LV \d+-TŐL$/).length).toBeGreaterThan(0)
  expect(screen.queryByText('🔒')).toBeNull()
})
