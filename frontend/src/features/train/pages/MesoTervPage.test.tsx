import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { http } from 'msw'
import { MesoTervPage } from '@/features/train/pages/MesoTervPage'
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
        <MesoTervPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

// --- The poster (Train Titanium T9 Task 3, mezo-88iwa.10) ---
// The landing IS the running block now: no `Mesociklusok` h1, no `+ Új` chip, no
// library sections. Every number is derived from mocks[0] (meso-hyp-04: week 3 of 6,
// phaseCurve MEV MEV MAV MAV MRV Deload) through logic/mesoBands.ts + wizard/dayTiles.ts,
// never hard-coded against the prototype's illustrative copy.

test('the poster is ONE button carrying its own a11y name, with the block name inside', () => {
  setup()
  const poster = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  expect(poster).toHaveTextContent('Hypertrophy 04 · Tavasz')
})

test('the poster leads with the week numeral (3. hét / 6)', () => {
  setup()
  const poster = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  expect(poster).toHaveTextContent('3. hét')
  expect(poster).toHaveTextContent('/ 6')
})

test('the phase pill reads the derived phase (meso-hyp-04 week 3 = MAV -> Rámpa)', () => {
  setup()
  expect(screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })).toHaveTextContent('Rámpa')
})

test('a Deload week says Pihenőhét in the pill — never the engine word', () => {
  // The language rule (T9): `deload` is engine vocabulary; the page speaks „pihenőhét".
  // Derivation check on the copy map, mirrored by the sentence assertion below.
  setup()
  const poster = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  expect(poster).not.toHaveTextContent(/deload/i)
})

test('the poster carries ONE plain sentence: where you are, what it weighs, when the pihenőhét lands', () => {
  setup()
  const poster = screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' })
  // set total = sum of runBands(meso).current over its 8 tracked groups
  // (14+16+12+10+10+12+10+12 = 96) — the same math mesoBands.test.ts pins; 5 training
  // days (Szo = volleyball, Vas = rest are off-days); the Deload is week 6 → 3 weeks out.
  expect(poster).toHaveTextContent('A 6 hétből a 3. héten jársz: 96 szett, 5 edzésnapra osztva — 3 hét múlva jön a pihenőhét.')
})

test('the whole-poster tap opens the builder deep-link (the ActiveMesoCard contract)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Aktív mezociklus megnyitása' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-hyp-04')
})

// --- „A heted" day cards ---

test('every training day is a card with its FULL weekday name and its type', () => {
  setup()
  // meso-hyp-04 trains Hét/Kedd/Sze/Csü/Pén; Szo is volleyball, Vas is rest.
  expect(screen.getByRole('button', { name: 'Hétfő · Push' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Szerda · Legs' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Péntek · Push · light' })).toBeInTheDocument()
})

test('a day card carries its boxed facts (szett / perc / gyakorlat) from dayTileData', () => {
  setup()
  // Hétfő: 4+3+3+3+3 = 16 working sets, round(16 * 4.4) = 70 perc, 5 exercises.
  const monday = screen.getByRole('button', { name: 'Hétfő · Push' })
  expect(monday).toHaveTextContent('16szett')
  expect(monday).toHaveTextContent('70perc')
  expect(monday).toHaveTextContent('5gyakorlat')
})

test('rest and sport days are slim rows, not cards', () => {
  setup()
  expect(screen.queryByRole('button', { name: /^Vasárnap/ })).toBeNull()
  expect(screen.getByText('pihenőnap')).toBeInTheDocument()
  expect(screen.getByText('Volleyball · meccs')).toBeInTheDocument()
})

test('a day card opens that day\'s own page', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Szerda · Legs' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-hyp-04/days/Sze')
})

// --- The MA chip (todayDayToken, mesoDates.ts) ---
describe('the MA chip marks today wherever it lands', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('a Thursday puts MA on the Csütörtök card (and its a11y name says · ma)', () => {
    vi.setSystemTime(new Date('2026-07-16T12:00:00')) // Thursday
    setup()
    const thursday = screen.getByRole('button', { name: 'Csütörtök · ma · Pull' })
    expect(thursday).toHaveTextContent('MA')
    expect(screen.getAllByText('MA')).toHaveLength(1)
  })

  it('a Sunday puts MA on the rest ROW — the chip is not card-only', () => {
    vi.setSystemTime(new Date('2026-07-19T12:00:00')) // Sunday
    setup()
    expect(screen.getAllByText('MA')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Csütörtök · ma/ })).toBeNull()
  })
})

// --- The two dest tiles ---

test('the Melyik izmod hol tart tile carries the rollover forecast and opens the week page', async () => {
  const user = userEvent.setup()
  setup()
  const tile = screen.getByRole('button', { name: 'Melyik izmod hol tart' })
  // nextRolloverChips: the groups that actually climb on Monday (sage tone).
  expect(tile).toHaveTextContent(/izom kap többet hétfőtől|Hétfőtől minden izom tart/)
  await user.click(tile)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-hyp-04/week')
})

test('the Edzéstervek tile opens the moved library', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Edzéstervek' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/konyvtar')
})

test('the landing no longer carries the +Új chip — Új blokk lives on the konyvtar page', () => {
  setup()
  expect(screen.queryByRole('button', { name: 'Új' })).toBeNull()
})

// --- The quiet close row → the EXISTING MesoCloseSheet ---

test('the quiet close row opens the shared MesoCloseSheet', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Edzésterv lezárása' }))
  // The sheet's own heading (MesoCloseSheet, mezo-meyc.2) — the builder's surface, reused.
  expect(await screen.findByRole('heading', { name: 'Futam lezárása' })).toBeInTheDocument()
  expect(screen.getByText(/Hypertrophy 04 · Tavasz futam lezárul/)).toBeInTheDocument()
})

// --- The kalauz anchor must have a home on EVERY state of this page ---

test('the kalauz anchor sits on the dest row, which always renders', () => {
  const { container } = render(
    <QueryWrapper>
      <MemoryRouter>
        <MesoTervPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(container.querySelector('[data-kalauz-anchor="mesociklus-mosaic"]')).not.toBeNull()
})

// Loading skeleton (mezo-f2z) — real mode shows the MesocycleSkeleton (role="status")
// while the meso/today queries are unresolved (workoutPending, which drives `mesocycles`);
// mock seeds → no skeleton.
describe('MesoTervPage (real mode, pending)', () => {
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

describe('MesoTervPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    setup()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

// --- No active block: the page says so honestly and keeps the doorway ---

describe('no active block', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('renders the honest line + the Edzéstervek doorway (and still anchors the kalauz)', async () => {
    server.use(http.get(`${API_BASE}/api/train/mesocycles`, () => Response.json([])))
    const { container } = render(
      <QueryWrapper>
        <MemoryRouter>
          <MesoTervPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryWrapper>,
    )
    expect(await screen.findByText(/Még nincs mesociklusod/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edzéstervek' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Melyik izmod hol tart' })).toBeNull()
    expect(container.querySelector('[data-kalauz-anchor="mesociklus-mosaic"]')).not.toBeNull()
  })
})
