// ============================================================
// Mezo · MesoKonyvtarPage tests — the Titanium „Edzéstervek" landing
// (Train Titanium T10 Task 2, mezo-88iwa.11).
//
// Rewritten from the DS-era suite: the mosaic tiles, the Tervezett list and the whole
// Történet/Összevetés block are no longer this page's — the closed runs moved to
// `MesoFutamokPage` (MesoFutamokPage.test.tsx carries their tests, moved verbatim).
// What is asserted here is the new anatomy: the hero's four REAL counts, the four card
// kinds (Most fut / Következnek / Új terv / the two doorways), the absent-active empty
// state, the queued card's own-page navigation (NO one-tap activation — that silently
// archives the running plan with no close ceremony/report) + its reassurance/hint line,
// and the skeleton.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MesoKonyvtarPage } from '@/features/train/pages/MesoKonyvtarPage'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'
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
        <MesoKonyvtarPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

// --- The hero: page-naming poster copy + four REAL counts ---------------------
// The mock fixture (data/train/train.ts) is 1 active + 2 planned + 3 archived runs and
// 2 templates — every number below is that fixture, never a prototype-illustrative one.

test('the hero names the page and says what lives here, jargon-free', () => {
  setup()
  expect(screen.getByRole('heading', { name: 'A terveid' })).toBeInTheDocument()
  expect(screen.getByText('Edzéstervek')).toBeInTheDocument()
  expect(screen.getByText(/Itt élnek a terveid/)).toBeInTheDocument()
})

test('the facts row carries the four real counts', () => {
  setup()
  expect(screen.getByText('1 fut')).toBeInTheDocument()
  expect(screen.getByText('2 következik')).toBeInTheDocument()
  expect(screen.getByText('2 sablon')).toBeInTheDocument()
  expect(screen.getByText('3 lezárva')).toBeInTheDocument()
})

test('the back pill is docked INSIDE the hero, not in a row above it', () => {
  const { container } = render(
    <QueryWrapper><MemoryRouter><MesoKonyvtarPage /></MemoryRouter></QueryWrapper>,
  )
  const back = screen.getByRole('button', { name: 'Vissza' })
  expect(back).toHaveClass('mz-backbtn')
  // The docking CSS keys on `.pl-lhero > .mz-backbtn` — a pill that drifts out of the
  // hero would silently lose its position, so assert the PARENT, not just the class.
  expect(back.parentElement).toBe(container.querySelector('.pl-lhero'))
})

// --- „Most fut" --------------------------------------------------------------

test('the Most fut card carries the active run and opens the Terv landing', async () => {
  const user = userEvent.setup()
  setup()
  const card = screen.getByRole('button', { name: 'Most fut · Hypertrophy 04 · Tavasz' })
  expect(card).toHaveClass('pl-lib-card', 'is-now')
  expect(card).toHaveTextContent('3. hét a 6-ból')
  expect(card).toHaveTextContent('Pull / Push / Legs · 5×/hét')
  await user.click(card)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles')
})

// --- „Következnek" -----------------------------------------------------------

test('each planned run gets a queued card with weeks, nap/hét and split — the start date said once, in the head', () => {
  setup()
  const card = screen.getByRole('button', { name: 'Tervezett · Strength 02 · Nyár' })
  expect(card).toHaveClass('pl-lib-card', 'is-queued')
  expect(card).toHaveTextContent('Jún 16-tól')
  expect(card).toHaveTextContent('7')
  expect(card).toHaveTextContent('hét')
  expect(card).toHaveTextContent('4×/hét')
  expect(card).toHaveTextContent('Upper / Lower')
  // No duplicated date: the head's „Jún 16-tól" is the only place the date appears.
  const occurrences = (card.textContent ?? '').split('Jún 16').length - 1
  expect(occurrences).toBe(1)
  expect(screen.getByRole('button', { name: 'Tervezett · Pre-cut maintenance · Aug' })).toBeInTheDocument()
})

test('the queued card body opens the plan\'s own page (the builder) — no one-tap activation', async () => {
  const user = userEvent.setup()
  setup()
  // No activation affordance survives on the card at all — activating a plan silently
  // archives the running one with no close ceremony/report.
  expect(screen.queryByRole('button', { name: /Indítás|Aktiválás/ })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Tervezett · Strength 02 · Nyár' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-str-02')
})

test('the queued card carries the reassurance line when an active run is already queued behind', () => {
  setup()
  const card = screen.getByRole('button', { name: 'Tervezett · Strength 02 · Nyár' })
  expect(card).toHaveTextContent('Akkor indul, amikor a mostani terved lezárul.')
  expect(card).not.toHaveTextContent('Nyisd meg, és onnan indíthatod.')
})

// --- „Új terv" + the two doorways --------------------------------------------

test('Új terv összeállítása opens the planner', async () => {
  const user = userEvent.setup()
  setup()
  const cta = screen.getByRole('button', { name: 'Új terv összeállítása' })
  expect(cta).toHaveClass('pl-lib-new')
  await user.click(cta)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/new')
})

test('the Sablonjaid doorway carries the template count and opens the templates tab', async () => {
  const user = userEvent.setup()
  setup()
  const dest = screen.getByRole('button', { name: 'Sablonjaid' })
  expect(dest).toHaveClass('pl-dest', 'is-plans')
  expect(dest).toHaveTextContent('2 sablon, amiből indíthatsz')
  await user.click(dest)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/templates')
})

test('the Lezárt futamaid doorway carries the closed count and opens the futamok page', async () => {
  const user = userEvent.setup()
  setup()
  const dest = screen.getByRole('button', { name: 'Lezárt futamaid' })
  expect(dest).toHaveClass('pl-dest', 'is-done')
  expect(dest).toHaveTextContent('3 lezárt terv története')
  await user.click(dest)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/futamok')
})

// --- What LEFT the page ------------------------------------------------------

test('the closed-run list and its Összevetés mode moved off this page', () => {
  setup()
  expect(screen.queryByText(/Történet/)).toBeNull()
  expect(screen.queryByRole('button', { name: /Összevetés/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Újrafuttatás/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Sablonná/ })).toBeNull()
  // …and the DS-era mosaic tiles went with the reface
  expect(screen.queryByRole('button', { name: /Új blokk tervezése/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Futóblokkok' })).toBeNull()
})

// --- Route/render smoke test + the kalauz anchor ------------------------------

describe('mounted at /train/mesocycles/konyvtar via the router', () => {
  beforeEach(() => seedAllKalauzSeen())

  function renderApp(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] })
    return render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  }

  it('renders the Titanium landing at its real path, kalauz anchor and all', async () => {
    const { container } = renderApp('/train/mesocycles/konyvtar')
    expect(await screen.findByRole('heading', { name: 'A terveid' })).toBeInTheDocument()
    expect(container.querySelector('[data-kalauz-anchor="konyvtar-hero"]')).not.toBeNull()
  })

  it('the back pill returns to /train/mesocycles', async () => {
    const user = userEvent.setup()
    renderApp('/train/mesocycles/konyvtar')
    await screen.findByRole('heading', { name: 'A terveid' })
    await user.click(screen.getByRole('button', { name: 'Vissza' }))
    // The Terv landing re-mounts — its whole-poster button proves the navigation.
    expect(await screen.findByRole('button', { name: 'Aktív mezociklus megnyitása' })).toBeInTheDocument()
  })

  it('the Lezárt futamaid doorway reaches a REAL route, not a 404', async () => {
    const user = userEvent.setup()
    renderApp('/train/mesocycles/konyvtar')
    await screen.findByRole('heading', { name: 'A terveid' })
    await user.click(screen.getByRole('button', { name: 'Lezárt futamaid' }))
    // the closed list's own Titanium heading (T10 Task 4) — „Lezárt futamaid" is its eyebrow
    expect(await screen.findByRole('heading', { name: 'Amit lezártál' })).toBeInTheDocument()
  })
})

// --- No running plan: a quiet line, never a fake card ------------------------

describe('no active run (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('says so in one line and counts 0 fut — no Most fut card is drawn', async () => {
    server.use(http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])))
    setup()
    expect(await screen.findByText(/Most nem fut terv/)).toBeInTheDocument()
    // 0 is the TRUTH about this library, so it renders as 0 rather than hiding the fact.
    expect(screen.getByText('0 fut')).toBeInTheDocument()
    expect(screen.getByText('0 következik')).toBeInTheDocument()
    expect(screen.getByText('0 lezárva')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Most fut/ })).toBeNull()
    // the „start something new" CTA and the doorways still stand
    expect(screen.getByRole('button', { name: 'Új terv összeállítása' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lezárt futamaid' })).toBeInTheDocument()
  })

  it('formats a real-mode ISO startDate to HU display, and shows the builder-hint line with no active run queued behind it', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json([
          {
            id: 'real-planned-01',
            title: 'Real Planned Run',
            shortTitle: 'Real Planned',
            status: 'planned',
            goal: '',
            startDate: '2026-06-16', // ISO — the backend's own shape, unlike the mock fixture's pre-formatted 'Jún 16'
            endDate: '2026-08-04',
            weeks: 7,
            currentWeek: 0,
            split: 'Upper / Lower · 4×/hét',
            style: 'Linear · 7 hét',
            phaseCurve: [],
            musclePriorities: null,
          },
        ]),
      ),
    )
    setup()
    const card = await screen.findByRole('button', { name: 'Tervezett · Real Planned Run' })
    expect(card).toHaveTextContent('Jún 16-tól')
    // No active run behind it → the builder-pointing hint, not the „akkor indul" reassurance.
    expect(card).toHaveTextContent('Nyisd meg, és onnan indíthatod.')
    expect(card).not.toHaveTextContent('Akkor indul, amikor a mostani terved lezárul.')
  })
})

// --- Skeleton (the missing T9-residue test) ----------------------------------
// Real mode shows the rewritten layout-aware `MesocycleSkeleton` (role="status") while
// the meso + template queries are unresolved; mock seeds synchronously → no skeleton.

describe('MesoKonyvtarPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('shows the new-geometry skeleton while the queries are unresolved', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => new Promise(() => {})),
      http.get(`${API_BASE}/api/train/workouts/today`, () => new Promise(() => {})),
      http.get(`${API_BASE}/api/train/meso-templates`, () => new Promise(() => {})),
    )
    setup()
    const status = await screen.findByRole('status')
    // Shape, not just presence (the T5 skeleton-test idiom): hero → running card →
    // two queued cards → the loud CTA → the two doorways, in the page's own order.
    const sk = Array.from(status.querySelectorAll('.sk')) as HTMLElement[]
    const order = sk
      .map((el) => el.style.height)
      .filter((h) => ['220px', '70px', '112px', '115px'].includes(h))
    expect(order).toEqual(['220px', '70px', '112px', '112px', '70px', '115px', '115px'])
  })
})

describe('MesoKonyvtarPage (mock mode)', () => {
  it('renders content with no skeleton (synchronous seed)', () => {
    setup()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
