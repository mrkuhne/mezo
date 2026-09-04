import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { GoalPlansPage } from '@/features/me/pages/GoalPlansPage'

const mocks = vi.hoisted(() => ({ useGoal: vi.fn(), useGoalOverview: vi.fn(), detachPlan: vi.fn() }))
vi.mock('@/data/hooks', () => ({
  useGoal: mocks.useGoal,
  useGoalOverview: mocks.useGoalOverview,
  useGoalActions: () => ({ detachPlan: mocks.detachPlan, pending: false }),
}))
vi.mock('@/features/me/sheets/AttachPlanSheet', () => ({ AttachPlanSheet: ({ planType }: { planType: string }) => <div role="dialog">Picker: {planType}</div> }))

const plans = {
  links: [{ id: 'm1', planType: 'mesocycle', planId: 'p1', startWeek: 2, endWeek: 5, plan: { title: 'Erőblokk', status: 'active', startDate: '2026-09-01', endDate: '2026-09-28', weeks: 4 } }],
  gaps: [{ fromWeek: 1, toWeek: 1 }],
  sportSchedule: [{ id: 's1', dayOfWeek: 2, time: '19:00', durationMin: 75, kind: 'training', location: 'Városi csarnok', sport: 'handball' }],
  activeLinkCount: 1, uncoveredWeekCount: 1, topIssueCode: 'mesocycle_gap',
}
const renderPage = () => render(<MemoryRouter><GoalPlansPage /></MemoryRouter>)

beforeEach(() => {
  mocks.detachPlan.mockReset()
  mocks.useGoal.mockReturnValue({ goalId: 'g1', pending: false })
  mocks.useGoalOverview.mockReturnValue({ overview: { courseStatus: 'on_track', totalWeeks: 8, plans }, pending: false })
})

test('shows server-owned plans, sport schedule and gap without static club copy', () => {
  renderPage()
  expect(screen.getByText('Erőblokk')).toBeInTheDocument()
  expect(screen.getByText(/Városi csarnok/)).toBeInTheDocument()
  expect(screen.getByText('W1 fedezetlen')).toBeInTheDocument()
  expect(screen.queryByText(/BVSC|végig/i)).not.toBeInTheDocument()
})

test('opens the shared attach sheet with the selected plan type', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: /Mesociklus csatolása/ }))
  expect(screen.getByRole('dialog')).toHaveTextContent('mesocycle')
})

test('renders loading and invalid fail-safe states', () => {
  mocks.useGoalOverview.mockReturnValueOnce({ overview: null, pending: true })
  const first = renderPage()
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  first.unmount()
  mocks.useGoalOverview.mockReturnValue({ overview: { courseStatus: 'invalid', totalWeeks: 8, plans }, pending: false })
  renderPage()
  expect(screen.getByText('Céljavítás szükséges')).toBeInTheDocument()
})
