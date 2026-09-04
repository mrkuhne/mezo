import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { GoalSegmentPage } from '@/features/me/pages/GoalSegmentPage'

const mocks = vi.hoisted(() => ({ useGoal: vi.fn(), useGoalOverview: vi.fn() }))
vi.mock('@/data/hooks', () => ({ useGoal: mocks.useGoal, useGoalOverview: mocks.useGoalOverview }))
const segment = { available: true, label: 'MAV', fromWeek: 3, toWeek: 5, remainingDays: 5, nextLabel: 'Deload', nextFromWeek: 6, nextChangeDate: '2026-09-14', explanationCode: 'mesocycle_phase' }
const renderPage = () => render(<MemoryRouter><GoalSegmentPage /></MemoryRouter>)

beforeEach(() => {
  mocks.useGoal.mockReturnValue({ goalId: 'g1', pending: false })
  mocks.useGoalOverview.mockReturnValue({ overview: { courseStatus: 'on_track', segment }, pending: false })
})

test('shows current range, next segment and explains kcal independence', () => {
  renderPage()
  expect(screen.getAllByText('MAV')).toHaveLength(2)
  expect(screen.getAllByText(/W3–5/).length).toBeGreaterThan(0)
  expect(screen.getByText('Deload')).toBeInTheDocument()
  expect(screen.getByText(/nem becsül új kalóriaégetést/)).toBeInTheDocument()
})

test('supports loading, unavailable and no-next states', () => {
  mocks.useGoalOverview.mockReturnValueOnce({ overview: null, pending: true })
  const first = renderPage()
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  first.unmount()
  mocks.useGoalOverview.mockReturnValue({ overview: { courseStatus: 'on_track', segment: { ...segment, nextLabel: null, nextFromWeek: null, nextChangeDate: null } }, pending: false })
  renderPage()
  expect(screen.getByText('Nincs következő szakasz')).toBeInTheDocument()
})

test('shows an honest unavailable state without an invented segment', () => {
  mocks.useGoalOverview.mockReturnValue({ overview: { courseStatus: 'on_track', segment: { available: false, explanationCode: 'prescription_missing' } }, pending: false })
  renderPage()
  expect(screen.getByText('Nincs aktív szakasz')).toBeInTheDocument()
  expect(screen.queryByText('MAV')).not.toBeInTheDocument()
})
