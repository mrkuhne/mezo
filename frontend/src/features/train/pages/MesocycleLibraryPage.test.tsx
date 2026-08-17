import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
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

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function setup() {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <MesocycleLibraryPage />
        <LocationProbe />
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
  // The title is shared with the template it was started from (Sablonok section),
  // so match the tappable hero card itself — the template card is a plain div.
  expect(screen.getByRole('button', { name: /Hypertrophy 04 · Tavasz/ })).toBeInTheDocument()
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

// --- Sablonok section (mezo-meyc.1): templates are the reusable blueprints; runs live below ---

test('renders the Sablonok section with the fixture templates and their run-count badges', () => {
  setup()
  expect(screen.getByText(/Sablonok · 2/)).toBeInTheDocument()
  // the never-run template's title is unique to the template list (the other one
  // shares its title with the active run below)
  expect(screen.getByText('Upper/Lower Power')).toBeInTheDocument()
  expect(screen.getByText('1× futtatva')).toBeInTheDocument()
  expect(screen.getByText('0× futtatva')).toBeInTheDocument()
})

test('a template card offers Szerkesztés + Indítás', () => {
  setup()
  expect(screen.getAllByRole('button', { name: /Szerkesztés/ })).toHaveLength(2)
  expect(screen.getAllByRole('button', { name: /Indítás/ })).toHaveLength(2)
})

test('Indítás on a template opens the start sheet', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getAllByRole('button', { name: /Indítás/ })[0])
  expect(await screen.findByRole('heading', { name: 'Mikor kezdjük?' })).toBeInTheDocument()
})

// --- Történet (was Archív) + rerun ---

test('the closed-run section head reads Történet, not Archív', () => {
  setup()
  expect(screen.getByText(/Történet · 1/)).toBeInTheDocument()
  expect(screen.queryByText('Archív · 1')).toBeNull() // the old section head is gone
})

test('tapping a closed run opens its RUN REPORT, not the builder (mezo-meyc.2)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: /Recovery rebuild · Tél/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-rec-03/report')
})

test('Újrafuttatás on a closed run reruns it and opens the start sheet', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getAllByRole('button', { name: /Újrafuttatás/ })[0])
  expect(await screen.findByRole('heading', { name: 'Mikor kezdjük?' })).toBeInTheDocument()
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
