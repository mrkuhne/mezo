import { render, screen } from '@testing-library/react'
import { QuickStat } from '@/components/ui/QuickStat'

test('renders label, value, unit, delta', () => {
  render(<QuickStat label="Alvás" value="7.2" unit="h" delta="+0.4" />)
  expect(screen.getByText('Alvás')).toBeInTheDocument()
  expect(screen.getByText('7.2')).toBeInTheDocument()
  expect(screen.getByText('h')).toBeInTheDocument()
  expect(screen.getByText('+0.4')).toBeInTheDocument()
})
