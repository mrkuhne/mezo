import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { http } from 'msw'
import { GymPage } from '@/features/train/pages/GymPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Asserts Phase-1 mock meso data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderView = () => render(<QueryWrapper><MemoryRouter><GymPage /></MemoryRouter></QueryWrapper>)

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

// Loading skeleton (mezo-f2z) — real mode shows the GymSkeleton (role="status")
// while the meso/today queries are unresolved (workoutPending); mock seeds → no skeleton.
describe('GymPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the meso + today queries are unresolved', async () => {
    // workoutPending = mesoPending || todayPending — both must never resolve.
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => new Promise(() => {})),
      http.get(`${API_BASE}/api/train/workouts/today`, () => new Promise(() => {})),
    )
    renderView()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('GymPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    renderView()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
