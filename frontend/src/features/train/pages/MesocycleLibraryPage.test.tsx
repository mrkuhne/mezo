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
  const { pathname, search } = useLocation()
  return <div data-testid="loc">{`${pathname}${search}`}</div>
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

// --- Status-first hub hero (mesocycle pages v2 Task 2, mezo-d20.15) ---
// The whole card is a button carrying its OWN accessible name (aria-label overrides the
// title text as the a11y name), so hero assertions query by that label and then look inside
// it for the status content — pulled from mesocycles[0] in data/train/train.ts via runBands/
// phaseChip/weekDots (logic/mesoBands.ts, Task 1), never hard-coded against the prototype's
// illustrative copy.

test('renders the active mesocycle hero card as a single button with its own a11y name', () => {
  setup()
  const hero = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  expect(hero).toBeInTheDocument()
  expect(hero).toHaveTextContent('Hypertrophy 04 · Tavasz')
})

test('hero eyebrow reads Aktív · <currentWeek>/<weeks> hét (meso-hyp-04: week 3 of 6)', () => {
  setup()
  const hero = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  expect(hero).toHaveTextContent('Aktív · 3/6 hét')
})

test('hero carries the phase chip (meso-hyp-04 week 3 = MAV -> Rámpa)', () => {
  setup()
  const hero = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  expect(hero).toHaveTextContent('Rámpa')
})

test('hero carries a current->ceiling band chip derived from runBands (back: current 16, already at its grow-tier MAV ceiling)', () => {
  setup()
  const hero = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  // meso-hyp-04's back band: mav=16=current -> step 'cap', so the chip is the plain
  // "Hát 16" form (no arrow) — see ActiveMesoCard's bandChipText.
  expect(hero).toHaveTextContent('Hát 16')
})

test('renders the active section label with its count', () => {
  setup()
  expect(screen.getByText(/Aktív · 1/)).toBeInTheDocument()
})

test('renders the new-mesocycle chip trigger in the header', () => {
  setup()
  // The header `+ Új` chip (exact name) — a plain creation entry left on the landing
  // alongside the `Edzéstervek` doorway to the moved library (mezo-88iwa.10 Task 2).
  expect(screen.getByRole('button', { name: 'Új' })).toBeInTheDocument()
})

// --- Hub tiles: `Heti vizsgálat` (mesocycle pages v2 Task 2) ---
// The only mosaic tile left on the landing after Task 2 moved Sablonok/Új blokk/
// Futóblokkok to MesoKonyvtarPage.tsx — it is active-meso-gated and stays reachable here.

test('the hub\'s first tile is Heti vizsgálat, with a W<currentWeek> · <set total> szett line', async () => {
  const user = userEvent.setup()
  setup()
  // meso-hyp-04 week 3, set total = sum of runBands(meso).current across its 8 tracked
  // muscle groups (14+16+12+10+10+12+10+12 = 96) — see mesoBands.test.ts for the same math.
  const tile = screen.getByRole('button', { name: 'Heti vizsgálat' })
  expect(tile).toHaveTextContent('W3 · 96 szett')
  await user.click(tile)
  // Task 4 owns the /week route — navigating there now is the router's no-match, which is
  // fine for this slice; what matters here is the tile fires the intended destination.
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-hyp-04/week')
})

// --- The Edzéstervek doorway (mezo-88iwa.10 Task 2) ---
// The library moved to /train/mesocycles/konyvtar; the landing keeps a plain doorway to it
// (Task 3 replaces this page's whole face with the running-block poster).

test('the Edzéstervek doorway navigates to the moved library', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Edzéstervek' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/konyvtar')
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

// --- Hero "Ma · <nap> · <típus>" line (todayDayToken, mesoDates.ts) ---
describe('hero "Ma" line reads today\'s day off meso.days', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('shows Ma · <nap> · <type> for today\'s matching meso.days row (Thursday = Csü = Pull)', () => {
    vi.setSystemTime(new Date('2026-07-16T12:00:00')) // Thursday
    setup()
    const hero = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
    expect(hero).toHaveTextContent('Ma · Csü · Pull')
  })
})
