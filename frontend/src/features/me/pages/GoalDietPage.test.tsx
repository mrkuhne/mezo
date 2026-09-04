import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { GoalDietPage } from '@/features/me/pages/GoalDietPage'

const mocks = vi.hoisted(() => ({ useGoal: vi.fn(), useGoalOverview: vi.fn() }))
vi.mock('@/data/hooks', () => ({ useGoal: mocks.useGoal, useGoalOverview: mocks.useGoalOverview }))

const diet = { weekAverageKcal: 2780, todayDayType: 'training', todayKcal: 2940, trainingDayKcal: 2940, restDayKcal: 2580, proteinG: 188, carbsG: 361, fatG: 82, basis: 'formula', explanationCode: 'training_day_split' }
const renderPage = () => render(<MemoryRouter><GoalDietPage /></MemoryRouter>)

beforeEach(() => {
  mocks.useGoal.mockReturnValue({ goalId: 'g1', pending: false })
  mocks.useGoalOverview.mockReturnValue({ overview: { courseStatus: 'on_track', diet }, pending: false })
})

test('shows today type, macros, split, weekly average and provenance explanation', () => {
  renderPage()
  expect(screen.getAllByText('2 940 kcal')).toHaveLength(2)
  expect(screen.getAllByText('Edzésnap').length).toBeGreaterThan(0)
  expect(screen.getByText('188 g')).toBeInTheDocument()
  expect(screen.getByText('361 g')).toBeInTheDocument()
  expect(screen.getByText('82 g')).toBeInTheDocument()
  expect(screen.getByText('2 780 kcal')).toBeInTheDocument()
  expect(screen.getByText(/edzésnapok terheléséhez/)).toBeInTheDocument()
})

test('shows a uniform plan honestly', () => {
  mocks.useGoalOverview.mockReturnValue({ overview: { courseStatus: 'on_track', diet: { ...diet, todayDayType: 'uniform', trainingDayKcal: null, restDayKcal: null } }, pending: false })
  renderPage()
  expect(screen.getAllByText('Egységes keret').length).toBeGreaterThan(0)
})

test('labels a rest day and keeps its lower target in the hero', () => {
  mocks.useGoalOverview.mockReturnValue({ overview: { courseStatus: 'on_track', diet: { ...diet, todayDayType: 'rest', todayKcal: 2580, explanationCode: 'rest_day_split' } }, pending: false })
  renderPage()
  expect(screen.getAllByText('2 580 kcal')).toHaveLength(2)
  expect(screen.getAllByText('Pihenőnap').length).toBeGreaterThan(0)
})

test('loading and invalid states never leak stale calories', () => {
  mocks.useGoalOverview.mockReturnValueOnce({ overview: null, pending: true })
  const first = renderPage()
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  first.unmount()
  mocks.useGoalOverview.mockReturnValue({ overview: { courseStatus: 'invalid', diet }, pending: false })
  renderPage()
  expect(screen.getByText('Céljavítás szükséges')).toBeInTheDocument()
  expect(screen.queryByText('2 940 kcal')).not.toBeInTheDocument()
})
