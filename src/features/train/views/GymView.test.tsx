import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GymView } from './GymView'

const renderView = () => render(<MemoryRouter><GymView /></MemoryRouter>)

test('own page-header: brand eyebrow + meso short title + week badge', () => {
  renderView()
  expect(screen.getByText('Train · GYM')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Hypertrophy 04' })).toBeInTheDocument()
  expect(screen.getByText('W3 / 6')).toBeInTheDocument()
})

test('meso meta card shows the phase stat', () => {
  renderView()
  expect(screen.getByText('Fázis')).toBeInTheDocument()
})

test('tapping the current training day (Csü Pull) opens the detail sheet', () => {
  renderView()
  // The day cards are unambiguous via aria-label "{type} · {day}".
  // The active meso's Csü day has type "Pull" (the Pull Day).
  const pullDay = screen.getByRole('button', { name: /Pull · Csü/ })
  fireEvent.click(pullDay)
  // Sheet now shows the first exercise of that day.
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
})
