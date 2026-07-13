import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TabBar } from '@/app/TabBar'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><TabBar /></MemoryRouter>)
}

test('renders the four tab labels and no Insights tab', () => {
  renderAt('/today')
  for (const label of ['Ma', 'Edzés', 'Fuel', 'Én']) expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.queryByText('Insights')).not.toBeInTheDocument()
})
test('marks the current route tab active', () => {
  renderAt('/fuel')
  expect(screen.getByText('Fuel').closest('a')!.className).toContain('active')
  expect(screen.getByText('Ma').closest('a')!.className).not.toContain('active')
})
test('the center + button opens the quick-log sheet', async () => {
  renderAt('/today')
  await userEvent.click(screen.getByRole('button', { name: 'Gyors logolás' }))
  expect(screen.getByText('Gyors logolás', { selector: 'h2' })).toBeInTheDocument()
  expect(screen.getByText('Étkezés')).toBeInTheDocument()
})
