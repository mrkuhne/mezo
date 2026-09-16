// ============================================================
// Mezo · MesoFutamokPage tests (Train Titanium T10 Task 4, mezo-88iwa.11).
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
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
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

test('mounted at /train/mesocycles/futamok via the router, with a back pill to the library', async () => {
  seedAllKalauzSeen()
  const user = userEvent.setup()
  const router = createMemoryRouter(routes, { initialEntries: ['/train/mesocycles/futamok'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  expect(await screen.findByRole('heading', { name: 'Amit végigvittél' })).toBeInTheDocument()
  expect(screen.getByText('Lezárt futamaid')).toBeInTheDocument() // the hero's eyebrow
  await user.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByRole('heading', { name: 'A terveid' })).toBeInTheDocument()
})

test('the hero states only what the closed runs themselves carry: their count and their weeks', () => {
  const { container } = setup()
  // three closed runs since the mezo-meyc.4 fix wave: the compare pair (with reports) plus
  // a third, report-less run so selection mode has something to refuse a third pick on.
  expect(screen.getByText('3 lezárt futam')).toBeInTheDocument()
  // 8 + 6 + 6 weeks — summed off the rows, no report fetched for it
  expect(screen.getByText('20 hét összesen')).toBeInTheDocument()
  // The prototype's session/record totals are NOT invented: neither exists on a Mesocycle.
  // Pinned against the shapes those facts would take ("N edzés a M-ből", "N rekord"), not
  // against the bare words — "Edzéstervek" on the back pill would satisfy a loose /edzés/.
  expect(screen.queryByText(/\d+\s*edzés/)).toBeNull()
  expect(screen.queryByText(/\d+\s*rekord/)).toBeNull()
  // and no star row anywhere on the LIST — completionPct lives only in the frozen report
  expect(container.querySelector('.pl-stars')).toBeNull()
})

test('a closed row draws the run name, its window and its weeks', () => {
  setup()
  const card = screen.getByRole('button', { name: /Recovery rebuild · Tél/ })
  expect(within(card).getByText('Feb 12 – Ápr 23')).toBeInTheDocument() // closedAt, not endDate
  expect(within(card).getByText('8 hét')).toBeInTheDocument()
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
  // the card's own actions step aside while selecting
  expect(screen.queryByRole('button', { name: /Újrafuttatás/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Sablonná/ })).toBeNull()
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
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/meso-rec-03/report')
})
