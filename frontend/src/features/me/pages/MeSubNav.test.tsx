import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MeSubNav } from '@/features/me/pages/MeSubNav'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MeSubNav />
    </MemoryRouter>,
  )
}

test('renders all sub-nav items with verbatim labels', () => {
  renderAt('/me')
  for (const label of ['Profil', 'Growth', 'Cél', 'Súly', 'Alvás', 'Emberek', 'Tudás']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})

test('Growth tab sits right after Profil and links to /me/growth', () => {
  renderAt('/me')
  const links = screen.getAllByRole('link')
  const labels = links.map((l) => l.textContent)
  expect(labels.slice(0, 2)).toEqual(['Profil', 'Growth'])
  expect(screen.getByRole('link', { name: 'Growth' })).toHaveAttribute('href', '/me/growth')
})

test('MeSubNav exposes a Súly tab linking to /me/weight', () => {
  renderAt('/me')
  const link = screen.getByRole('link', { name: 'Súly' })
  expect(link).toHaveAttribute('href', '/me/weight')
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
