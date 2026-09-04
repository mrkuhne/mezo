import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { GoalGuardsPage } from '@/features/me/pages/GoalGuardsPage'

const mocks = vi.hoisted(() => ({ useGoal: vi.fn(), useGoalOverview: vi.fn() }))
vi.mock('@/data/hooks', () => ({ useGoal: mocks.useGoal, useGoalOverview: mocks.useGoalOverview }))
const guards = {
  status: {
    strength: { active: true, e1rmTrendPct: -3.2, breached: true, notes: ['Két lift gyengült.'] },
    muscle: { active: false, minWeeklySetsPerMuscle: 8, belowMaintenanceMuscles: ['mell'], rateWithinCap: false, proteinMonitored: false, notes: [] },
  },
  healthyCount: 2, totalCount: 4, topIssueCode: 'strength_breached',
}
const renderPage = () => render(<MemoryRouter><GoalGuardsPage /></MemoryRouter>)

beforeEach(() => {
  mocks.useGoal.mockReturnValue({ goalId: 'g1', pending: false })
  mocks.useGoalOverview.mockReturnValue({ overview: { courseStatus: 'on_track', guards }, pending: false })
})

test('shows shield summary, typed guard states and top warning', () => {
  renderPage()
  expect(screen.getByText('2 / 4')).toBeInTheDocument()
  expect(screen.getByText(/Az erővédelem jelzett/)).toBeInTheDocument()
  expect(screen.getByText('Beavatkozás kell')).toBeInTheDocument()
  expect(screen.getByText('Nincs bekapcsolva')).toBeInTheDocument()
})

test('renders loading and invalid fail-safe states', () => {
  mocks.useGoalOverview.mockReturnValueOnce({ overview: null, pending: true })
  const first = renderPage()
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  first.unmount()
  mocks.useGoalOverview.mockReturnValue({ overview: { courseStatus: 'invalid', guards }, pending: false })
  renderPage()
  expect(screen.getByText('Céljavítás szükséges')).toBeInTheDocument()
})
