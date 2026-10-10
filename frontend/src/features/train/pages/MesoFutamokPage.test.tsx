// ============================================================
// Mezo · MesoFutamokPage tests (Train Titanium T10 Task 4, mezo-88iwa.11; the face is
// Folyadék F3 since mezo-n4wf5.3 — prototype vilagos/edzes.js `futamok()`).
// The Történet section moved off the refaced library landing in Task 2; Task 4 gave
// it the Titanium closed-list face, so these tests now cover BOTH halves: the moved
// behaviours (compare mode, Újrafuttatás, Sablonná, tap → report) in their new
// anatomy, and the new anatomy's own honesty rules — the hero states only totals the
// mesocycle rows genuinely carry, and a closed row draws NO stars (completion lives
// in the frozen report, which the list deliberately does not fetch N times).
// ============================================================
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { MesoFutamokPage } from '@/features/train/pages/MesoFutamokPage'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const { pathname, search } = useLocation()
  // search included since mezo-meyc.4 — the compare CTA's payload IS its query string.
  return <div data-testid="loc">{`${pathname}${search}`}</div>
}

function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter>
        <MesoFutamokPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

/** A closed run's row in the list (the hero's vessels carry the short name, the rows the full one). */
const row = (title: string) => screen.getByRole('button', { name: `Lezárt futam · ${title}` })
const hero = () => document.querySelector('.fo-hero') as HTMLElement

test('mounted at /train/mesocycles/futamok via the router, and the title bar\'s back leads to the library', async () => {
  seedAllKalauzSeen()
  const user = userEvent.setup()
  const router = createMemoryRouter(routes, { initialEntries: ['/train/mesocycles/futamok'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  expect(await screen.findByText('Amit lezártál')).toBeInTheDocument()
  // the shell's title bar names the page and where it hangs
  expect(screen.getByRole('heading', { name: 'Lezárt futamaid' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('Itt élnek a terveid.')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/train/mesocycles/konyvtar')
})

test('the hero states only what the closed runs themselves carry: their count and their weeks', () => {
  const { container } = setup()
  // three closed runs since the mezo-meyc.4 fix wave: the compare pair (with reports) plus
  // a third, report-less run so selection mode has something to refuse a third pick on.
  // 8 + 6 + 6 weeks — summed off the rows, no report fetched for it
  expect(hero().querySelector('.fo-hero-verdict')?.textContent).toBe('3 lezárt futam, 20 hét összesen.')
  // Session / record totals are NOT invented: neither exists on a Mesocycle.
  // Pinned against the shapes those facts would take ("N edzés a M-ből", "N rekord"), not
  // against the bare words.
  expect(screen.queryByText(/\d+\s*edzés/)).toBeNull()
  expect(screen.queryByText(/\d+\s*rekord/)).toBeNull()
  // no completion %, no star row anywhere on the LIST — completionPct lives only in the frozen report
  expect(container.textContent).not.toMatch(/%/)
  expect(container.querySelector('.pl-stars, .glass, [class*="pl-"], [class*="mz-"]')).toBeNull()
})

// Each closed run is a vessel: the level is its number of weeks, a run without a frozen report is hatched.
test('the hero draws one vessel per closed run — level by weeks, hatched without a report', async () => {
  const user = userEvent.setup()
  setup()
  const tubes = within(hero()).getByRole('group', { name: 'Lezárt futamaid: egy edény egy futam' })
  const vials = [...tubes.querySelectorAll('button.fo-vial')] as HTMLElement[]
  expect(vials).toHaveLength(3)
  expect(vials.map((v) => v.querySelector('b')?.textContent)).toEqual(['8 hét', '6 hét', '6 hét'])
  expect(vials.map((v) => v.classList.contains('hatch'))).toEqual([false, false, true])
  const level = (v: HTMLElement) => parseFloat((v.querySelector('.l') as HTMLElement).style.getPropertyValue('--p'))
  expect(level(vials[0])).toBeCloseTo(94, 5) // the longest run fills its vessel
  expect(level(vials[1])).toBeCloseTo((6 / 8) * 94, 5)
  // a vessel opens the run's report, like its row
  await user.click(vials[0])
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-rec-03/report')
})

test('a closed row draws the run name, its window and its weeks', () => {
  setup()
  // closedAt, not endDate
  expect(row('Recovery rebuild · Tél').querySelector('small')?.textContent).toMatch(/^Feb 12 – Ápr 23 · 8 hét/)
  expect(row('Recovery rebuild · Tél').querySelector('use')?.getAttribute('href')).toBe('#t-scroll')
})

test('tapping a closed run opens its RUN REPORT, not the builder (mezo-meyc.2)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(row('Recovery rebuild · Tél'))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-rec-03/report')
})

test('Újrafuttatás on a closed run reruns it and opens the start sheet', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getAllByRole('button', { name: /Újrafuttatás/ })[0])
  expect(await screen.findByRole('heading', { name: 'Mikor kezdjük?' })).toBeInTheDocument()
})

test('Sablonná on a closed run saves it as a template and opens the new editor (mezo-tlwa)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getAllByRole('button', { name: /Sablonná/ })[0])
  await waitFor(() =>
    expect(screen.getByTestId('loc').textContent).toMatch(/^\/train\/mesocycles\/templates\/.+/),
  )
})

// --- Összevetés selection mode (mezo-meyc.4) ---------------------------------

test('a closed run advertises whether it HAS a report', () => {
  setup()
  // two of the three fixture runs carry one; the third (meso-cut-02) has none — the row wears the stamp.
  const stamps = [...document.querySelectorAll('.ep-log .fo-st')]
  expect(stamps.map((n) => n.textContent)).toEqual(['riport', 'riport', 'nincs riport'])
  expect(stamps.map((n) => n.classList.contains('ok'))).toEqual([true, true, false])
})

test('Összevetés turns row taps into selection instead of navigation', async () => {
  const user = userEvent.setup()
  setup()
  const toggle = within(hero()).getByRole('button', { name: 'Összevetés' })
  expect(toggle).toHaveClass('fo-btn')
  expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await user.click(toggle)
  // the same button, now pressed, is the way out of the mode
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(toggle).toHaveTextContent('Mégsem')
  expect(screen.getByText('Válassz két lezárt futamot (0/2).')).toBeInTheDocument()

  const card = row('Recovery rebuild · Tél')
  await user.click(card)
  // selected, NOT navigated to the report
  expect(card).toHaveAttribute('aria-pressed', 'true')
  expect(card.closest('.ep-log')?.querySelector('.ep-tk')).toHaveClass('on')
  expect(card.closest('.ep-log')?.querySelector('.ep-tk')?.textContent).toBe('1') // the tap order
  expect(screen.getByText('Válassz két lezárt futamot (1/2).')).toBeInTheDocument()
  expect(screen.getByTestId('loc').textContent).toBe('/')
  // its vessel in the hero is ringed too
  expect(hero().querySelector('.fo-vial.sel b')?.textContent).toBe('8 hét')
  // the row's own actions step aside while selecting
  expect(screen.queryByRole('button', { name: /Újrafuttatás/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Sablonná/ })).toBeNull()
})

// The hero's vessels select too — a tap there is the same tap.
test('in selection mode a vessel selects its run', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Összevetés' }))
  await user.click(hero().querySelectorAll('button.fo-vial')[1])
  expect(row('Hypertrophy 03 · Ősz')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByTestId('loc').textContent).toBe('/')
})

test('a third tap in selection mode is refused — the pair from the first two taps stands', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Összevetés' }))

  await user.click(row('Hypertrophy 03 · Ősz'))
  await user.click(row('Recovery rebuild · Tél'))
  // the confirm CTA already carries a complete pair
  expect(screen.getByRole('button', { name: /Összevetés megnyitása/ })).toBeInTheDocument()
  expect(screen.getByText('A két kiválasztott futam egymás mellett')).toBeInTheDocument()

  const third = row('Cut prep · Nyár')
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
  await user.click(screen.getByRole('button', { name: 'Összevetés' }))
  // no CTA until the pair is complete
  expect(screen.queryByRole('button', { name: /Összevetés megnyitása/ })).toBeNull()

  await user.click(row('Hypertrophy 03 · Ősz'))
  await user.click(row('Recovery rebuild · Tél'))
  await user.click(screen.getByRole('button', { name: /Összevetés megnyitása/ }))

  expect(screen.getByTestId('loc').textContent).toBe(
    '/train/mesocycles/compare?a=meso-hyp-03&b=meso-rec-03',
  )
})

test('tapping a selected run deselects it; leaving the mode clears the selection', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Összevetés' }))
  const rec = row('Recovery rebuild · Tél')
  await user.click(rec)
  await user.click(rec)
  expect(rec).toHaveAttribute('aria-pressed', 'false')

  // select a pair, toggle the mode off and back on -> nothing is selected any more
  await user.click(rec)
  await user.click(row('Hypertrophy 03 · Ősz'))
  expect(screen.getByRole('button', { name: /Összevetés megnyitása/ })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Mégsem' }))
  await user.click(screen.getByRole('button', { name: 'Összevetés' }))
  expect(screen.queryByRole('button', { name: /Összevetés megnyitása/ })).toBeNull()
  expect(row('Recovery rebuild · Tél')).toHaveAttribute('aria-pressed', 'false')
})

test('outside selection mode a closed run still opens its report', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Összevetés' }))
  await user.click(screen.getByRole('button', { name: 'Mégsem' })) // back off
  await user.click(row('Recovery rebuild · Tél'))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-rec-03/report')
})

// --- States (prototype `futamok.ures`, `futamok.tolt`) ------------------------
describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('no closed run yet: the hero says so in an empty vessel, and there is nothing to compare', async () => {
    server.use(http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])))
    setup()
    expect(await screen.findByText('Még nincs lezárt futamod.')).toBeInTheDocument()
    expect(screen.getByText('Még nincs lezárt futamod — az első terved lezárása után itt lesz a története.').closest('.fo-ev')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Összevetés' })).toBeNull()
  })

  test('the loading face is the kit skeleton in the shape of the page', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => new Promise(() => {})),
      http.get(`${API_BASE}/api/train/meso-templates`, () => new Promise(() => {})),
    )
    setup()
    const status = await screen.findByRole('status', { name: 'Betöltés…' })
    expect([...status.querySelectorAll('i')].map((el) => (el as HTMLElement).style.height)).toEqual(['260px', '130px', '130px', '130px'])
  })
})
