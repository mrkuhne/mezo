// ============================================================
// Mezo · MesoKonyvtarPage tests — the „Edzéstervek" landing (Folyadék F3, mezo-n4wf5.3;
// first written for Train Titanium T10 Task 2, mezo-88iwa.11).
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
import { render, screen, within } from '@testing-library/react'
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

const hero = () => document.querySelector('.fo-hero') as HTMLElement

// Folyadék F3 (mezo-n4wf5.3; prototype vilagos/edzes.js `konyvtar()`).
test('the hero names the page and says what lives here, jargon-free', () => {
  setup()
  expect(hero().querySelector('.fo-hero-lbl')?.textContent).toBe('Edzéstervek')
  expect(hero().querySelector('.fo-hero-verdict')?.textContent).toBe('Itt élnek a terveid.')
  expect(screen.getByText('Ami fut, ami jön, és ami már mögötted van.')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/blokk|mesociklus/i)
})

test('the rows and the hero wear Folyadék-jel icons by meaning, no clay glyph and no old skin left', () => {
  const { container } = render(
    <QueryWrapper>
      <MemoryRouter>
        <MesoKonyvtarPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  const iconOf = (name: string) => screen.getByRole('button', { name }).querySelector('use')?.getAttribute('href')
  expect(iconOf('Most fut · Hypertrophy 04 · Tavasz')).toBe('#t-peak')
  expect(iconOf('Sablonjaid')).toBe('#t-template')
  expect(iconOf('Lezárt futamaid')).toBe('#t-history')
  const clay = Array.from(container.querySelectorAll('use'))
    .map((u) => u.getAttribute('href') ?? '')
    .filter((h) => /^#[is]-/.test(h))
  expect(clay).toEqual([])
  expect(container.querySelector('.glass, [class*="pl-"], [class*="mz-"]')).toBeNull()
})

test('the facts row carries the four real counts', () => {
  setup()
  expect(screen.getByText('1 fut')).toBeInTheDocument()
  expect(screen.getByText('2 következik')).toBeInTheDocument()
  expect(screen.getByText('2 sablon')).toBeInTheDocument()
  expect(screen.getByText('3 lezárva')).toBeInTheDocument()
})

// The plans as a pipeline: the running one half full (week 3 of 6), the coming ones waiting behind it; a
// vessel's length is the plan's number of weeks.
test('the hero draws the plans as a pipeline — the running one filled to its week, the next ones waiting', async () => {
  const user = userEvent.setup()
  setup()
  const pipes = [...hero().querySelectorAll('.ep-queue button')] as HTMLElement[]
  expect(pipes).toHaveLength(3)
  expect(pipes[0]).toHaveClass('now')
  expect(pipes[0].querySelector('b')?.textContent).toBe('3/6')
  expect((pipes[0].querySelector('span i') as HTMLElement).style.width).toBe('50%')
  expect(pipes[1].querySelector('b')?.textContent).toBe('7 hét')
  expect(pipes[1].querySelector('span i')).toBeNull()
  // length = weeks + 2
  expect(pipes.map((p) => p.style.flexGrow)).toEqual(['8', '9', '5']) // 6, 7 and 3 weeks
  await user.click(screen.getByRole('button', { name: 'Strength 02 · Nyár megnyitása' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-str-02')
})

test('the Most fut row carries the active run and opens the Terv landing', async () => {
  const user = userEvent.setup()
  setup()
  const row = screen.getByRole('button', { name: 'Most fut · Hypertrophy 04 · Tavasz' })
  expect(row).toHaveClass('fo-row')
  expect(row).toHaveTextContent('3. hét a 6-ból')
  expect(row).toHaveTextContent('Pull / Push / Legs · 5×/hét')
  await user.click(row)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles')
})

test('each planned run gets a block with weeks, frequency and split — the start date said once, in the row', () => {
  setup()
  const row = screen.getByRole('button', { name: 'Tervezett · Strength 02 · Nyár' })
  const block = row.closest('.ep-log')!
  expect(row).toHaveTextContent('Jún 16-tól')
  expect(row).toHaveTextContent('Upper / Lower')
  expect([...block.querySelectorAll('.fo-facts div')].map((d) => d.textContent)).toEqual(['7hét', '4×hetente'])
  // the start date is said ONCE (in the row), not repeated in a fact box
  const occurrences = (block.textContent ?? '').split('Jún 16').length - 1
  expect(occurrences).toBe(1)
  expect(screen.getByRole('button', { name: 'Tervezett · Pre-cut maintenance · Aug' })).toBeInTheDocument()
})

test('the planned row opens the plan\'s own page — no one-tap activation', async () => {
  const user = userEvent.setup()
  setup()
  // activating silently archives the running plan: the deliberate path is the plan page's dated button
  expect(screen.queryByRole('button', { name: /Indítás|Aktiválás/ })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Tervezett · Strength 02 · Nyár' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-str-02')
})

test('the planned block carries the reassurance line when a running plan is ahead of it', () => {
  setup()
  const block = screen.getByRole('button', { name: 'Tervezett · Strength 02 · Nyár' }).closest('.ep-log')!
  expect(block).toHaveTextContent('Akkor indul, amikor a mostani terved lezárul.')
  expect(block).not.toHaveTextContent('Nyisd meg, és onnan indíthatod.')
})

test('Új terv összeállítása is the hero\'s one button and opens the planner', async () => {
  const user = userEvent.setup()
  setup()
  const cta = within(hero()).getByRole('button', { name: 'Új terv összeállítása' })
  expect(cta).toHaveClass('fo-btn')
  expect(screen.getByText('Sablonból indulsz, vagy nulláról építed')).toBeInTheDocument()
  await user.click(cta)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/new')
})

test('the Sablonjaid row carries the template count and opens the templates tab', async () => {
  const user = userEvent.setup()
  setup()
  const dest = screen.getByRole('button', { name: 'Sablonjaid' })
  expect(dest).toHaveClass('fo-row')
  expect(dest).toHaveTextContent('2 sablon, amiből indíthatsz')
  await user.click(dest)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/templates')
})

test('the Lezárt futamaid row carries the closed count and opens the futamok page', async () => {
  const user = userEvent.setup()
  setup()
  const dest = screen.getByRole('button', { name: 'Lezárt futamaid' })
  expect(dest).toHaveClass('fo-row')
  expect(dest).toHaveTextContent('3 lezárt terv története')
  await user.click(dest)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/futamok')
})

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

  it('renders the landing at its real path — title bar, kalauz anchor and all', async () => {
    const { container } = renderApp('/train/mesocycles/konyvtar')
    expect(await screen.findByText('Itt élnek a terveid.')).toBeInTheDocument()
    // the frame's title bar names the page and where it hangs
    expect(screen.getByRole('heading', { name: 'Edzéstervek' })).toBeInTheDocument()
    expect(container.querySelector('.fo-hero[data-kalauz-anchor="konyvtar-hero"]')).not.toBeNull()
  })

  it('the title bar\'s back returns to /train/mesocycles', async () => {
    const user = userEvent.setup()
    renderApp('/train/mesocycles/konyvtar')
    await screen.findByText('Itt élnek a terveid.')
    await user.click(screen.getByRole('button', { name: 'Vissza' }))
    // The Terv landing re-mounts — its hero button proves the navigation.
    expect(await screen.findByRole('button', { name: 'A terv oldala' })).toBeInTheDocument()
  })

  it('the Lezárt futamaid doorway reaches a REAL route, not a 404', async () => {
    const user = userEvent.setup()
    renderApp('/train/mesocycles/konyvtar')
    await screen.findByText('Itt élnek a terveid.')
    await user.click(screen.getByRole('button', { name: 'Lezárt futamaid' }))
    // the closed list's own hero label
    expect(await screen.findByText('Amit lezártál')).toBeInTheDocument()
  })
})

// --- No running plan: a quiet line, never a fake card ------------------------

describe('no active run (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('says so in one line and counts 0 fut — no Most fut card is drawn', async () => {
    server.use(http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])))
    setup()
    expect(await screen.findByText('Most nem fut terv — indíts egyet alább.')).toBeInTheDocument()
    // nothing runs and nothing waits: no pipeline is drawn
    expect(document.querySelector('.ep-queue')).toBeNull()
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
    const card = (await screen.findByRole('button', { name: 'Tervezett · Real Planned Run' })).closest('.ep-log') as HTMLElement
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
    const status = await screen.findByRole('status', { name: 'Betöltés…' })
    // The kit's skeleton in the shape of the page (prototype `konyvtar('tolt')`): hero → the running plan →
    // the coming ones → the shelf.
    expect(status).toHaveClass('fo-sk')
    expect([...status.querySelectorAll('i')].map((el) => (el as HTMLElement).style.height)).toEqual(['280px', '90px', '170px', '120px'])
  })
})

describe('MesoKonyvtarPage (mock mode)', () => {
  it('renders content with no skeleton (synchronous seed)', () => {
    setup()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
