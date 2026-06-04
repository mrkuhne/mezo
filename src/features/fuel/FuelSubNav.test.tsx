import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FuelSubNav } from './FuelSubNav'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><FuelSubNav /></MemoryRouter>)
}

test('renders all five sub-nav items with verbatim labels', () => {
  renderAt('/fuel')
  for (const label of ['Mai', 'Terv', 'Stack', 'Receptek', 'Kamra']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})

test('marks the active sub-view from the URL', () => {
  const { container } = renderAt('/fuel/recipes')
  expect(container.querySelector('.subnav-item.active')).toHaveTextContent('Receptek')
})

test('Mai (index) is active only on exact /fuel', () => {
  const { container } = renderAt('/fuel/plan')
  expect(container.querySelector('.subnav-item.active')).toHaveTextContent('Terv')
})
