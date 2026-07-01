import { render, screen } from '@testing-library/react'
import { QuickStatsRow } from '@/features/today/components/QuickStatsRow'
import { InsightsTeaser } from '@/features/today/components/InsightsTeaser'

test('QuickStatsRow shows the three stats', () => {
  render(<QuickStatsRow />)
  expect(screen.getByText('Alvás')).toBeInTheDocument()
  expect(screen.getByText('Súly')).toBeInTheDocument()
  expect(screen.getByText('HRV')).toBeInTheDocument()
})
test('InsightsTeaser shows the pattern + link chip', () => {
  render(<InsightsTeaser />)
  expect(screen.getByText(/Új minta/)).toBeInTheDocument()
  expect(screen.getByText('Insights → Patterns')).toBeInTheDocument()
})
