import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { WeightTrendChart } from '@/features/me/components/WeightTrendChart'
import type { WeightEntry } from '@/data/types'
import type { GoalResponse } from '@/lib/goalApi'

const log: WeightEntry[] = [
  { date: '2026-05-11', value: 80.3 }, { date: '2026-05-15', value: 79.2 },
  { date: '2026-05-19', value: 79.4 }, { date: '2026-05-22', value: 78.6 },
]
const goalResponse = {
  startDate: '2026-04-01', targetDate: '2026-08-15', startWeightKg: 81.4, targetWeightKg: 73.0,
} as unknown as GoalResponse

test('renders an svg with the plan legend when a goal exists', () => {
  const { container } = render(<WeightTrendChart log={log} goalResponse={goalResponse} period="30d" />)
  expect(container.querySelector('svg')).toBeInTheDocument()
  expect(screen.getByText('terv')).toBeInTheDocument()
  expect(screen.getByText('tűréssáv')).toBeInTheDocument()
})

test('no goal → actual-only, no plan legend', () => {
  render(<WeightTrendChart log={log} goalResponse={null} period="30d" />)
  expect(screen.queryByText('terv')).not.toBeInTheDocument()
  expect(screen.getByText('tényleges')).toBeInTheDocument()
})

test('insufficient data in window → hint', () => {
  render(<WeightTrendChart log={[{ date: '2026-05-22', value: 78.6 }]} goalResponse={null} period="7d" />)
  expect(screen.getByText(/Kevés mérés/)).toBeInTheDocument()
})
