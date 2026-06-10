import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MesocycleLibraryView } from './MesocycleLibraryView'

function setup() {
  render(
    <MemoryRouter>
      <MesocycleLibraryView />
    </MemoryRouter>,
  )
}

test('renders the active mesocycle hero card', () => {
  setup()
  expect(screen.getByText('Hypertrophy 04 · Tavasz')).toBeInTheDocument()
})

test('renders a planned mesocycle', () => {
  setup()
  expect(screen.getByText('Strength 02 · Nyár')).toBeInTheDocument()
})

test('renders the active section label with its count', () => {
  setup()
  expect(screen.getByText(/Aktív · 1/)).toBeInTheDocument()
})

test('renders the new-mesocycle chip trigger in the header', () => {
  setup()
  // The header `+ Új` chip (exact name) — distinct from the dashed
  // "+ Új mesociklus tervezése" CTA further down the page.
  expect(screen.getByRole('button', { name: 'Új' })).toBeInTheDocument()
})
