import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GoalDietWeekCard } from '@/features/me/components/GoalDietWeekCard'

test('aligns training, rest and weekly average values in one comparison row', () => {
  render(<GoalDietWeekCard trainingDayKcal={2940} restDayKcal={2580} weekAverageKcal={2780} />)
  expect(screen.getByText('Edzésnap')).toBeInTheDocument()
  expect(screen.getByText('Pihenőnap')).toBeInTheDocument()
  expect(screen.getByText('Heti átlag')).toBeInTheDocument()
  expect(screen.getByText('2 940 kcal')).toBeInTheDocument()
  expect(screen.getByText('2 580 kcal')).toBeInTheDocument()
  expect(screen.getByText('2 780 kcal')).toBeInTheDocument()
})

test('renders an honest uniform plan without inventing a day split', () => {
  render(<GoalDietWeekCard weekAverageKcal={2700} />)
  expect(screen.getByText(/Egységes keret/)).toBeInTheDocument()
  expect(screen.queryByText('Edzésnap')).not.toBeInTheDocument()
})
