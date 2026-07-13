import { render, screen } from '@testing-library/react'
import { QuickStat } from '@/shared/ui/QuickStat'

test('renders label, value+unit, and a colored mini-ring svg', () => {
  const { container } = render(<QuickStat label="Alvás" value="7.2" unit="h" color="var(--lav)" pct={90} />)
  expect(screen.getByText('Alvás')).toBeInTheDocument()
  expect(screen.getByText('7.2h')).toBeInTheDocument()
  expect(container.querySelectorAll('svg')).toHaveLength(1)
})
