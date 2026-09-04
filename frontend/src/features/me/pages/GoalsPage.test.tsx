import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import type { GoalOverviewResponse, GoalResponse } from '@/data/me/goalApi'
import type { Goal } from '@/data/types'
import { GoalsPage } from '@/features/me/pages/GoalsPage'
import { QueryWrapper } from '@/test/queryWrapper'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useGoal: vi.fn(),
  useGoalOverview: vi.fn(),
  useBiometricProfile: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mocks.navigate }
})

vi.mock('@/data/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/data/hooks')>('@/data/hooks')
  return { ...actual, useGoal: mocks.useGoal, useGoalOverview: mocks.useGoalOverview, useBiometricProfile: mocks.useBiometricProfile }
})

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryWrapper><MemoryRouter>{children}</MemoryRouter></QueryWrapper>
}

const GOAL: Goal = {
  id: 'g1', title: 'Utolsó Cut', kind: 'cut', status: 'active', startWeight: 84.2,
  currentWeight: 82.4, targetWeight: 78,
  rateTarget: { value: 0.7, unit: '%/hét', direction: 'down' },
  mesocycles: [], identityFrame: 'Erősen érem el a célom.', mealsPerDay: null, wakeTime: null, bedTime: null,
}

const GOAL_RESPONSE: GoalResponse = {
  id: 'g1', title: 'Utolsó Cut', trajectory: 'cut', guards: ['strength', 'muscle'], status: 'active',
  startDate: '2026-08-24', targetDate: '2026-10-24', startWeightKg: 84.2, targetWeightKg: 78,
  rateTargetPctPerWeek: 0.7,
}

const OVERVIEW: GoalOverviewResponse = {
  goalId: 'g1', title: 'Utolsó Cut', trajectory: 'cut', status: 'active', currentWeek: 3, totalWeeks: 8,
  completionPct: 29, currentWeightKg: 82.4, targetWeightKg: 78, remainingKg: 4.4,
  courseStatus: 'on_track', courseReasonCode: 'rate_on_track', observedRateKgPerWeek: -0.68,
  targetRateKgPerWeek: -0.74, projectedTargetDate: '2026-10-24', dataSufficiency: 'full',
  diet: {
    weekAverageKcal: 2780, todayDayType: 'training', todayKcal: 2940, trainingDayKcal: 2940,
    restDayKcal: 2580, proteinG: 188, carbsG: 361, fatG: 82, basis: 'formula',
    explanationCode: 'training_day_split',
  },
  segment: {
    available: true, label: 'MAV', fromWeek: 3, toWeek: 5, remainingDays: 5, nextLabel: 'Deload',
    nextFromWeek: 6, nextChangeDate: '2026-09-14', explanationCode: 'mesocycle_phase',
  },
  plans: {
    links: [], gaps: [{ fromWeek: 7, toWeek: 8 }], sportSchedule: [], activeLinkCount: 2,
    uncoveredWeekCount: 2, topIssueCode: 'mesocycle_gap',
  },
  guards: { status: null, healthyCount: 3, totalCount: 4, topIssueCode: 'rate_off_track' },
  openSuggestionCount: 1, latestSuggestionId: 'sug-1',
}

function useActiveGoal() {
  mocks.useGoal.mockReturnValue({ goal: GOAL, goalResponse: GOAL_RESPONSE, linkedMesocycles: {}, timeline: null, goalId: 'g1', pending: false })
}

beforeEach(() => {
  mocks.navigate.mockReset()
  mocks.useGoal.mockReset()
  mocks.useGoalOverview.mockReset()
  mocks.useBiometricProfile.mockReturnValue({ isComplete: true })
  useActiveGoal()
  mocks.useGoalOverview.mockReturnValue({ overview: OVERVIEW, pending: false })
})

test('renders the layout-aware skeleton while the overview is loading', () => {
  mocks.useGoalOverview.mockReturnValue({ overview: null, pending: true })
  render(<GoalsPage />, { wrapper: Wrapper })
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
})

test('renders the creation CTA when there is no active goal', () => {
  mocks.useGoal.mockReturnValue({ goal: null, goalResponse: null, linkedMesocycles: {}, timeline: null, goalId: null, pending: false })
  mocks.useGoalOverview.mockReturnValue({ overview: null, pending: false })
  render(<GoalsPage />, { wrapper: Wrapper })
  expect(screen.getByText(/Még nincs aktív célod/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Új cél/ })).toBeEnabled()
})

test('renders the on-track course hero and six actionable tiles when a suggestion is open', () => {
  const { container } = render(<GoalsPage />, { wrapper: Wrapper })
  expect(screen.getByRole('heading', { name: 'Jó úton haladsz' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mai étrendi keret/ })).toBeEnabled()
  expect(container.querySelectorAll('.goal-hub-mosaic .mz-tile')).toHaveLength(6)
})

test('renders five tiles without leaving a suggestion gap', () => {
  mocks.useGoalOverview.mockReturnValue({ overview: { ...OVERVIEW, openSuggestionCount: 0, latestSuggestionId: null }, pending: false })
  const { container } = render(<GoalsPage />, { wrapper: Wrapper })
  expect(screen.queryByRole('button', { name: /Új javaslat/ })).not.toBeInTheDocument()
  expect(container.querySelectorAll('.goal-hub-mosaic .mz-tile')).toHaveLength(5)
})

test('renders the learning explanation from the server state', () => {
  mocks.useGoalOverview.mockReturnValue({
    overview: { ...OVERVIEW, courseStatus: 'learning', courseReasonCode: 'trend_missing', dataSufficiency: 'none' }, pending: false,
  })
  render(<GoalsPage />, { wrapper: Wrapper })
  expect(screen.getByRole('heading', { name: 'Még tanulom az ütemed' })).toBeInTheDocument()
  expect(screen.getByText(/több súlymérés/)).toBeInTheDocument()
})

test('invalid goals fail safe: coral status, no stale kcal, direct settings route', async () => {
  mocks.useGoalOverview.mockReturnValue({
    overview: {
      ...OVERVIEW, courseStatus: 'invalid', courseReasonCode: 'goal_invalid',
      diet: { todayDayType: 'unavailable', basis: 'unavailable', explanationCode: 'goal_invalid' },
    },
    pending: false,
  })
  render(<GoalsPage />, { wrapper: Wrapper })
  expect(screen.getByRole('heading', { name: 'A cél beállítása hibás' })).toBeInTheDocument()
  expect(screen.queryByText('3878 kcal')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Cél javítása/ }))
  expect(mocks.navigate).toHaveBeenCalledWith('/me/goals/weight/settings')
})

test.each([
  [/Mai étrendi keret/, '/me/goals/weight/diet'],
  [/Aktuális szakasz/, '/me/goals/weight/segment'],
  [/Tervkapcsolatok/, '/me/goals/weight/plans'],
  [/Védőkorlátok/, '/me/goals/weight/guards'],
  [/Új javaslat/, '/me/goals/weight/suggestions/sug-1'],
  [/Cél beállításai/, '/me/goals/weight/settings'],
] as const)('tile navigates to %s', async (name, route) => {
  render(<GoalsPage />, { wrapper: Wrapper })
  await userEvent.click(screen.getByRole('button', { name }))
  expect(mocks.navigate).toHaveBeenCalledWith(route)
})
