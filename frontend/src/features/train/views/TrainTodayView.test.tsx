import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrainTodayView } from './TrainTodayView'

const renderView = () => render(<MemoryRouter><TrainTodayView /></MemoryRouter>)

test('today gym block + weekly timeline render', () => {
  renderView()
  // "Pull Day" appears in both the gym hero (Display) and the weekly rows
  // (Sze + Csü schedule entries); the hero one is unique via "07:30 · 78p".
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
  expect(screen.getByText('07:30 · 78p')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Indítsuk/ })).toBeInTheDocument()
  expect(screen.getByText('Heti terv · gym + sport')).toBeInTheDocument()
  // weekly note (verbatim, substring)
  expect(screen.getByText(/A gym a mesociklus szerint/)).toBeInTheDocument()
})

test('own page-header: eyebrow + title + day-label', () => {
  renderView()
  expect(screen.getByText('Train · Mai')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edzés' })).toBeInTheDocument()
  // today is Csü ⇒ "Csütörtök · W3"
  expect(screen.getByText('Csütörtök · W3')).toBeInTheDocument()
})

test('no volleyball session today (Csü) ⇒ today-volleyball block is absent', () => {
  renderView()
  // The today-volleyball CTA must not be present initially (no vb today).
  expect(screen.queryByRole('button', { name: /Logold a session-t/ })).not.toBeInTheDocument()
})
