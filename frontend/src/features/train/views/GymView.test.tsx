import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { GymView } from './GymView'
import { QueryWrapper } from '@/test/queryWrapper'

// Asserts Phase-1 mock meso data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderView = () => render(<QueryWrapper><MemoryRouter><GymView /></MemoryRouter></QueryWrapper>)

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
