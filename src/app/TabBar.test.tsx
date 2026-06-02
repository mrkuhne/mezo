import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TabBar } from './TabBar'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><TabBar /></MemoryRouter>)
}

test('renders all five tab labels', () => {
  renderAt('/today')
  for (const label of ['Today', 'Train', 'Fuel', 'Insights', 'Me'])
    expect(screen.getByText(label)).toBeInTheDocument()
})
test('marks the current route tab active', () => {
  renderAt('/fuel')
  const fuel = screen.getByText('Fuel').closest('a')!
  expect(fuel.className).toContain('active')
  const today = screen.getByText('Today').closest('a')!
  expect(today.className).not.toContain('active')
})
