import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { GoalSettingsPage } from '@/features/me/pages/GoalSettingsPage'

const mocks = vi.hoisted(() => ({ useGoal: vi.fn(), useGoalOverview: vi.fn() }))
vi.mock('@/data/hooks', () => ({ useGoal: mocks.useGoal, useGoalOverview: mocks.useGoalOverview }))
vi.mock('@/features/me/sheets/EditGoalSheet', () => ({ EditGoalSheet: () => <div role="dialog">Cél kezelése</div> }))

const goal = { id: 'g1', title: 'Utolsó Cut', kind: 'cut', status: 'active', startWeight: 84.2, currentWeight: 82.4, targetWeight: 78, rateTarget: { value: .7, unit: '%/hét', direction: 'down' }, mesocycles: [], identityFrame: '' }
const goalResponse = { id: 'g1', title: 'Utolsó Cut', trajectory: 'cut', guards: ['strength', 'muscle'], status: 'active', startDate: '2026-08-24', targetDate: '2026-10-24', startWeightKg: 84.2, targetWeightKg: 78, rateTargetPctPerWeek: .7 }
const overview = { courseStatus: 'on_track', title: 'Utolsó Cut', trajectory: 'cut', currentWeek: 3, totalWeeks: 8, currentWeightKg: 82.4, targetWeightKg: 78, targetRateKgPerWeek: -0.74, projectedTargetDate: '2026-10-24', guards: { status: { strength: { active: true }, muscle: { active: true } }, healthyCount: 3, totalCount: 4 } }
const renderPage = () => render(<MemoryRouter><GoalSettingsPage /></MemoryRouter>)

beforeEach(() => {
  mocks.useGoal.mockReturnValue({ goal, goalResponse, goalId: 'g1', pending: false })
  mocks.useGoalOverview.mockReturnValue({ overview, pending: false })
})

test('shows trajectory, weights, window, signed rate and guard chips from overview', () => {
  renderPage()
  expect(screen.getByText('Fogyás')).toBeInTheDocument()
  expect(screen.getAllByText(/82,4 kg/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/78 kg/).length).toBeGreaterThan(0)
  expect(screen.getByText('W3 / 8')).toBeInTheDocument()
  expect(screen.getByText('−0,7 kg/hét')).toBeInTheDocument()
  expect(screen.getByText('Erővédelem')).toBeInTheDocument()
})

test('opens the existing edit sheet and keeps archive/delete inside it', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Cél szerkesztése' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Cél kezelése')
})

test('renders loading and invalid fail-safe states', () => {
  mocks.useGoalOverview.mockReturnValueOnce({ overview: null, pending: true })
  const first = renderPage()
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  first.unmount()
  mocks.useGoalOverview.mockReturnValue({ overview: { ...overview, courseStatus: 'invalid' }, pending: false })
  renderPage()
  expect(screen.getByText('Céljavítás szükséges')).toBeInTheDocument()
})
