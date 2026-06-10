import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MeSubNav } from './MeSubNav'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MeSubNav />
    </MemoryRouter>,
  )
}

test('renders all five sub-nav items with verbatim labels', () => {
  renderAt('/me')
  for (const label of ['Profil', 'Cél', 'Alvás', 'Emberek', 'Tudás']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})

test('marks the active sub-view from the URL', () => {
  const { container } = renderAt('/me/goals')
  const active = container.querySelector('.subnav-item.active')
  expect(active).toHaveTextContent('Cél')
})

test('Profil (index) is active only on exact /me', () => {
  const { container } = renderAt('/me/sleep')
  const active = container.querySelector('.subnav-item.active')
  expect(active).toHaveTextContent('Alvás')
  expect(active).not.toHaveTextContent('Profil')
})
