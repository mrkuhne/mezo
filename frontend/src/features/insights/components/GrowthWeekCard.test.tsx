import { render, screen } from '@testing-library/react'
import { GrowthWeekCard } from '@/features/insights/components/GrowthWeekCard'
import { growthWeek as mockGrowthWeek } from '@/data/insights/insights'
import type { WeeklyGrowth } from '@/data/types'

test('renders the populated growth rows with the formatted savings', () => {
  render(<GrowthWeekCard growth={mockGrowthWeek} />)
  expect(screen.getByText('Growth — heti')).toBeInTheDocument()
  expect(screen.getByText('9/14')).toBeInTheDocument()
  expect(screen.getByText('+120')).toBeInTheDocument()
  expect(screen.getByText('6')).toBeInTheDocument()
  expect(screen.getByText('50 000 Ft')).toBeInTheDocument()
})

test('hides the Megtakarítás row when savingsHuf is 0', () => {
  const g: WeeklyGrowth = { ...mockGrowthWeek, savingsHuf: 0 }
  render(<GrowthWeekCard growth={g} />)
  expect(screen.getByText('Tevékenységek')).toBeInTheDocument()
  expect(screen.queryByText('Megtakarítás')).not.toBeInTheDocument()
})

test('renders the honest empty line for null growth', () => {
  render(<GrowthWeekCard growth={null} />)
  expect(screen.getByText('Még nincs growth-adat ezen a héten.')).toBeInTheDocument()
})
