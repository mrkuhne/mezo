import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MeSubNav } from '@/features/me/pages/MeSubNav'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><MeSubNav /></MemoryRouter>)
}

test('renders all seven pills with verbatim labels', () => {
  renderAt('/me')
  for (const label of ['Profil', 'Growth', 'Cél', 'Súly', 'Alvás', 'Emberek', 'Tudás']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})

test('marks the active sub-view from the URL', () => {
  const { container } = renderAt('/me/goals')
  expect(container.querySelector('.np-pill.on')).toHaveTextContent('Cél')
})

test('Profil (index) is active only on exact /me', () => {
  const { container } = renderAt('/me/sleep')
  expect(container.querySelector('.np-pill.on')).toHaveTextContent('Alvás')
})
