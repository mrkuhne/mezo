import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { InsightsSubNav } from './InsightsSubNav'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><InsightsSubNav /></MemoryRouter>)
}

test('renders all seven sub-nav items with verbatim labels', () => {
  renderAt('/insights')
  for (const label of ['Patterns', 'Weekly', 'Memoir', 'Knowledge', 'Chat', 'Predictions', 'Experiments']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})

test('marks the active sub-view from the URL', () => {
  const { container } = renderAt('/insights/memoir')
  expect(container.querySelector('.subnav-item.active')).toHaveTextContent('Memoir')
})

test('Patterns (index) is active only on exact /insights', () => {
  const { container } = renderAt('/insights/chat')
  expect(container.querySelector('.subnav-item.active')).toHaveTextContent('Chat')
})
