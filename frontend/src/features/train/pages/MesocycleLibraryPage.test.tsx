import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { http } from 'msw'
import { MesocycleLibraryPage } from '@/features/train/pages/MesocycleLibraryPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Asserts Phase-1 mock meso data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <MesocycleLibraryPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('own header: pghead-np over + h1', () => {
  setup()
  expect(screen.getByText('Edzés · Mesociklusok')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Mesociklusok' })).toBeInTheDocument()
})

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

// Loading skeleton (mezo-f2z) — real mode shows the MesocycleSkeleton (role="status")
// while the meso/today queries are unresolved (workoutPending, which drives `mesocycles`);
// mock seeds → no skeleton.
describe('MesocycleLibraryPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the meso + today queries are unresolved', async () => {
    // workoutPending = mesoPending || todayPending — both must never resolve.
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => new Promise(() => {})),
      http.get(`${API_BASE}/api/train/workouts/today`, () => new Promise(() => {})),
    )
    setup()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('MesocycleLibraryPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    setup()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
