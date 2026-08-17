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
  // search included since mezo-meyc.4 — the compare CTA's payload IS its query string.
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
  // three closed runs since the mezo-meyc.4 fix wave: the compare pair (with reports) plus
  // a third, report-less run so selection mode has something to refuse a third pick on.
  expect(screen.getByText(/Történet · 3/)).toBeInTheDocument()
  expect(screen.queryByText('Archív · 3')).toBeNull() // the old section head is gone
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

// --- Összevetés selection mode (mezo-meyc.4) ---

test('a closed run advertises whether it HAS a report', () => {
  setup()
  // two of the three fixture runs carry one; the third (meso-cut-02) has none, and the
  // „nincs riport" ghost rendering itself is covered in ArchivedMesoCard.test
  expect(screen.getAllByText('riport')).toHaveLength(2)
  expect(screen.getByText('nincs riport')).toBeInTheDocument()
})

test('Összevetés turns card taps into selection instead of navigation', async () => {
  const user = userEvent.setup()
  setup()
  const toggle = screen.getByRole('button', { name: /Összevetés/ })
  // The `.chip[aria-pressed="true"]` DS rule needs both the class AND the attribute on the
  // same element to give the toggle its visible pressed state — assert the pairing, not
  // just the attribute (a class regression would silently drop the styling).
  expect(toggle).toHaveClass('chip')
  expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await user.click(toggle)
  expect(toggle).toHaveClass('chip')
  expect(toggle).toHaveAttribute('aria-pressed', 'true')

  const card = screen.getByRole('button', { name: /Recovery rebuild · Tél/ })
  await user.click(card)
  // selected, NOT navigated to the report
  expect(card).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByTestId('loc').textContent).toBe('/')
  // the rerun action steps aside while selecting
  expect(screen.queryByRole('button', { name: /Újrafuttatás/ })).toBeNull()
})

test('a third tap in selection mode is refused — the pair from the first two taps stands', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: /Összevetés/ }))

  await user.click(screen.getByRole('button', { name: /Hypertrophy 03 · Ősz/ }))
  await user.click(screen.getByRole('button', { name: /Recovery rebuild · Tél/ }))
  // the confirm CTA already carries a complete pair
  expect(screen.getByRole('button', { name: /Összevetés megnyitása/ })).toBeInTheDocument()

  const third = screen.getByRole('button', { name: /Cut prep · Nyár/ })
  await user.click(third)

  // the third card never entered selection…
  expect(third).toHaveAttribute('aria-pressed', 'false')
  // …and the first two ids are exactly what the CTA still opens
  await user.click(screen.getByRole('button', { name: /Összevetés megnyitása/ }))
  expect(screen.getByTestId('loc').textContent).toBe(
    '/train/mesocycles/compare?a=meso-hyp-03&b=meso-rec-03',
  )
})

test('two selected runs open the compare view with a= and b= in tap order', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: /Összevetés/ }))
  // no CTA until the pair is complete
  expect(screen.queryByRole('button', { name: /Összevetés megnyitása/ })).toBeNull()

  await user.click(screen.getByRole('button', { name: /Hypertrophy 03 · Ősz/ }))
  await user.click(screen.getByRole('button', { name: /Recovery rebuild · Tél/ }))
  await user.click(screen.getByRole('button', { name: /Összevetés megnyitása/ }))

  expect(screen.getByTestId('loc').textContent).toBe(
    '/train/mesocycles/compare?a=meso-hyp-03&b=meso-rec-03',
  )
})

test('tapping a selected run deselects it; leaving the mode clears the selection', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: /Összevetés/ }))
  const rec = screen.getByRole('button', { name: /Recovery rebuild · Tél/ })
  await user.click(rec)
  await user.click(rec)
  expect(rec).toHaveAttribute('aria-pressed', 'false')

  // select a pair, toggle the mode off and back on -> nothing is selected any more
  await user.click(rec)
  await user.click(screen.getByRole('button', { name: /Hypertrophy 03 · Ősz/ }))
  expect(screen.getByRole('button', { name: /Összevetés megnyitása/ })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /^Összevetés$/ }))
  await user.click(screen.getByRole('button', { name: /^Összevetés$/ }))
  expect(screen.queryByRole('button', { name: /Összevetés megnyitása/ })).toBeNull()
  expect(screen.getByRole('button', { name: /Recovery rebuild · Tél/ })).toHaveAttribute('aria-pressed', 'false')
})

test('outside selection mode a closed run still opens its report', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: /Összevetés/ }))
  await user.click(screen.getByRole('button', { name: /^Összevetés$/ })) // back off
  await user.click(screen.getByRole('button', { name: /Recovery rebuild · Tél/ }))
  expect(screen.getByTestId('loc').textContent).toBe('/train/mesocycles/meso-rec-03/report')
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
