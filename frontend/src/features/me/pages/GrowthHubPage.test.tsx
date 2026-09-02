import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { GrowthHubPage } from '@/features/me/pages/GrowthHubPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { progressionProfileMock } from '@/data/progression/progressionMock'
import { gamificationProfileMock } from '@/data/gamification/gamificationMock'
import { mockQuestDay, mockQuestHistory } from '@/data/quest/questMock'
import { mockActivities, mockActivityHistory } from '@/data/activity/activityMock'
import { achievementsMock } from '@/data/progression/achievementsMock'
import { mockHabitSummary } from '@/data/habit/habitMock'

const hooks = vi.hoisted(() => ({
  useProgressionProfile: vi.fn(), useGamification: vi.fn(), useHabitSummary: vi.fn(), useQuestHistory: vi.fn(),
  useActivityHistory: vi.fn(), useAchievements: vi.fn(), useDailyQuests: vi.fn(), useQuestActions: vi.fn(), useActivities: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/hooks')>()), ...hooks }))
vi.mock('@/shared/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/dates')>()), localDateString: () => '2026-07-12',
}))
function Loc() { const l = useLocation(); return <span data-testid="loc">{l.pathname}</span> }
function renderAt(path: string) {
  const router = createMemoryRouter([
    { path: '/me/growth', element: <><GrowthHubPage /><Loc /></> },
    { path: '*', element: <Loc /> },
  ], { initialEntries: [path] })
  return render(<QueryWrapper><LevelUpProvider><RouterProvider router={router} /></LevelUpProvider></QueryWrapper>)
}
beforeEach(() => {
  hooks.useProgressionProfile.mockReturnValue({ data: progressionProfileMock })
  hooks.useGamification.mockReturnValue({ profile: gamificationProfileMock, isPending: false })
  hooks.useHabitSummary.mockReturnValue({ data: mockHabitSummary, isPending: false })
  hooks.useQuestHistory.mockReturnValue({ data: mockQuestHistory, isPending: false })
  hooks.useActivityHistory.mockReturnValue({ data: mockActivityHistory, isPending: false })
  hooks.useAchievements.mockReturnValue({ data: achievementsMock })
  hooks.useDailyQuests.mockReturnValue({ quests: mockQuestDay, levelUps: [], rerollsLeft: 1, mode: 'mock' })
  hooks.useQuestActions.mockReturnValue({ reroll: vi.fn(), pending: false, consumeLevelUps: vi.fn() })
  hooks.useActivities.mockReturnValue({ data: mockActivities, isPending: false })
})
afterEach(() => vi.clearAllMocks())

test('hub anatomy: ‹ Én head, hero XP (FE sum 18 985), Ma strip, four tiles inside one EntranceGroup', () => {
  const { container } = renderAt('/me/growth')
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Én')
  expect(screen.getByText('18 985')).toBeInTheDocument()
  expect(screen.getByText('Szint 12')).toBeInTheDocument()          // gamificationProfileMock.level
  expect(screen.getByText('78%')).toBeInTheDocument()               // traits.disciplinePct
  expect(screen.getByRole('button', { name: 'Küldetések · a Nap fülön' })).toBeInTheDocument()
  for (const t of ['Skillek', 'Rutin', 'Napló', 'Kitüntetések']) expect(screen.getByRole('button', { name: t })).toBeInTheDocument()
  for (const r of container.querySelectorAll('.rise')) expect(r.closest('.mz-play')).not.toBeNull()
})

test('tile lines come from the page hooks — band lengths, habit counters, journal counts, badges + streak', () => {
  renderAt('/me/growth')
  expect(screen.getByRole('button', { name: 'Skillek' })).toHaveTextContent('33 skill · legjobb Lv 7')
  expect(screen.getByRole('button', { name: 'Rutin' })).toHaveTextContent('6 reggel · 4 este / 30')
  const completed = mockQuestHistory.filter((q) => q.status === 'completed').length
  expect(screen.getByRole('button', { name: 'Napló' })).toHaveTextContent(`${completed} ✓ · ${mockActivityHistory.length} ✎ · 30 nap`)
  expect(screen.getByRole('button', { name: 'Kitüntetések' })).toHaveTextContent('4 / 9 jelvény · 6 napos sorozat')
})

test('cold load (real mode, unresolved): Rutin and Napló render no tile line — Skillek/Kitüntetések unaffected', () => {
  hooks.useHabitSummary.mockReturnValue({ data: { perfectMorningDays30: 0, perfectEveningDays30: 0, habits: [] }, isPending: true })
  hooks.useQuestHistory.mockReturnValue({ data: [], isPending: true })
  hooks.useActivityHistory.mockReturnValue({ data: [], isPending: true })
  renderAt('/me/growth')
  expect(screen.getByRole('button', { name: 'Rutin' }).querySelector('.mz-tile-line')).toBeNull()
  expect(screen.getByRole('button', { name: 'Napló' }).querySelector('.mz-tile-line')).toBeNull()
  expect(screen.getByRole('button', { name: 'Skillek' }).querySelector('.mz-tile-line')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Kitüntetések' }).querySelector('.mz-tile-line')).not.toBeNull()
})

test('tiles navigate to their sibling routes', async () => {
  renderAt('/me/growth')
  await userEvent.click(screen.getByRole('button', { name: 'Skillek' }))
  expect(screen.getByTestId('loc').textContent).toBe('/me/growth/skillek')
})

test('legacy ?tab=awards deep link redirects to /me/growth/kituntetesek', () => {
  renderAt('/me/growth?tab=awards')
  expect(screen.getByTestId('loc').textContent).toBe('/me/growth/kituntetesek')
})

test('streak milestone within 10 days shows the pulse dot on Kitüntetések; far away hides it', () => {
  hooks.useGamification.mockReturnValue({ profile: { ...gamificationProfileMock, streakDays: 25 }, isPending: false })
  const { container, unmount } = renderAt('/me/growth')
  expect(container.querySelector('.gr-pulse')).not.toBeNull()
  unmount()
  hooks.useGamification.mockReturnValue({ profile: { ...gamificationProfileMock, streakDays: 8 }, isPending: false })
  const r2 = renderAt('/me/growth')
  expect(r2.container.querySelector('.gr-pulse')).toBeNull()
})
