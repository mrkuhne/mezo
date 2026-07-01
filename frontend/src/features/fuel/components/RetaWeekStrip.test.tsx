import { render, screen } from '@testing-library/react'
import { RetaWeekStrip } from '@/features/fuel/components/RetaWeekStrip'

test('renders 7 day cells with phase labels', () => {
  render(<RetaWeekStrip currentDay={3} />)
  expect(screen.getByText('D1')).toBeInTheDocument()
  expect(screen.getByText('D7')).toBeInTheDocument()
  expect(screen.getAllByText('Stable').length).toBeGreaterThan(0)
})
test('marks the current day active', () => {
  const { container } = render(<RetaWeekStrip currentDay={3} />)
  expect(container.querySelector('[data-active="true"]')).toHaveTextContent('D3')
})
