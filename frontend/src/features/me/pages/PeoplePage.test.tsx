// Emberek S3 hub (mezo-06o0.2) — PeoplePage becomes the Kapcsolatok hub: a hero + 3-cell
// stat strip + 4 navigation tiles (Jelöltek / A köröm / Említések / Heti kép, each a sibling
// page — WeekHub precedent, never a local show/hide) + the Mezo-band chat handoff.
// `now` is pinned to the mock seed's own "today" (2026-05-24) so hubLines' 7-day window lands
// on a known, hand-checked set of mentions (see data/me/people.ts) instead of drifting with
// the real clock.
//
// Navigation is asserted through a REAL react-router — no `vi.mock('react-router-dom', ...)`
// here (fix round 1, task review, Important): a mocked `useNavigate` only proves the tile
// called some function with some string, and would not catch a typo in either the tile's
// `navigate(...)` target or the registered route path. `createMemoryRouter` exercises the
// genuine navigation + matching. The Jelöltek flow uses the app's OWN `routes` export from
// `@/app/router` (registered for real, S3), so a drift between the tile's target and the
// router's registration fails here; `A köröm`/`Említések`/`Heti kép` still route to paths
// Task 3–5 own (not registered yet, per this task's scope), so those are asserted against a
// small test-local router's resulting `location.pathname` — real navigation, just not through
// a route that exists yet.
import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, useLocation, type RouteObject } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { ThemeProvider } from '@/app/ThemeProvider'
import { routes as appRoutes } from '@/app/router'
import { PeoplePage } from '@/features/me/pages/PeoplePage'
import { PeopleJeloltekPage } from '@/features/me/pages/PeopleJeloltekPage'

const NOW = new Date('2026-05-24T12:00:00')

// Flattens every person's affectTrend so nobody trends down/up — exercises the honest
// '—' fallback (statstrip down-cell) and the empty-circle Mezo-band sentence, both of
// which the always-has-a-down-person mock seed can never reach on its own.
const hoisted = vi.hoisted(() => ({ flattenTrends: false, empty: false }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    usePeople: () => {
      const real = actual.usePeople()
      if (hoisted.empty) return { ...real, people: [], mentions: [] }
      if (!hoisted.flattenTrends) return real
      return { ...real, people: real.people.map((p) => ({ ...p, affectTrend: [3, 3, 3, 3] })) }
    },
  }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  hoisted.flattenTrends = false
  hoisted.empty = false
})

/** Renders anything the whereabouts of `location.pathname`/`.search` — the catch-all target
 *  for the sibling routes this task does NOT register (Task 3–5's job). Real navigation
 *  still runs through react-router; we just don't have a real page to land on yet. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-probe">{location.pathname}{location.search}</div>
}

// Test-local router: the real PeoplePage + the real (S3-registered) PeopleJeloltekPage,
// and a probe for everything else (the future `kor`/`emlitesek`/`heti` targets + the chat
// handoff's `/mezo/chat?c=...`). Lighter than mounting the whole app tree for every test.
const localRoutes: RouteObject[] = [
  { path: '/me/people', element: <PeoplePage /> },
  { path: '/me/people/jeloltek', element: <PeopleJeloltekPage /> },
  { path: '*', element: <LocationProbe /> },
]

function renderPage() {
  const router = createMemoryRouter(localRoutes, { initialEntries: ['/me/people'] })
  const view = render(<RouterProvider router={router} />, { wrapper: QueryWrapper })
  return { ...view, router }
}

test('hero: Kapcsolatok + active-people bignum + the derived week-mention subline', () => {
  const { container } = renderPage()
  expect(screen.getByText('Kapcsolatok')).toBeInTheDocument()
  expect(container.querySelector('.mz-bignum')?.textContent).toBe('5')
  expect(screen.getByText('aktív kör · 9 említés e héten')).toBeInTheDocument()
})

test('statstrip: 3 cells — mentions·week, top name, down name (or em dash)', () => {
  const { container } = renderPage()
  const cells = container.querySelectorAll('.mz-statcell')
  expect(cells).toHaveLength(3)
  expect(cells[0].querySelector('b')?.textContent).toBe('9')
  expect(cells[0].querySelector('small')?.textContent).toBe('említés · hét')
  expect(cells[1].querySelector('b')?.textContent).toBe('Petra')
  expect(cells[1].querySelector('small')?.textContent).toBe('legtöbbet említett')
  expect(cells[2].querySelector('b')?.textContent).toBe('Réka ↘')
  expect(cells[2].querySelector('small')?.textContent).toBe('hangulat-lejtő')
})

test('CONTRACT: the down-cell reads em dash — never a fabricated name — when nobody trends down', () => {
  hoisted.flattenTrends = true
  const { container } = renderPage()
  const cells = container.querySelectorAll('.mz-statcell')
  expect(cells[2].querySelector('b')?.textContent).toBe('—')
  // With nobody trending down, the Mezo-band falls back to the top-name sentence.
  expect(screen.getByText(/Petra volt e héten a legtöbbet veled/)).toBeInTheDocument()
})

test('the empty-circle Mezo-band sentence renders when there is no data at all', () => {
  hoisted.empty = true
  renderPage()
  expect(screen.getByText(/Ahogy írsz, magától épül itt a kapcsolati kép\./)).toBeInTheDocument()
})

test('the Jelöltek tile navigates, through the REAL app router, to the real empty-state page (one continuous flow)', async () => {
  // Uses the app's own `routes` (from @/app/router) — a drift between the tile's
  // `navigate('/me/people/jeloltek')` and the router's own registration of that path
  // would fail this test, unlike a mocked `useNavigate` assertion.
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/me/people'] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Jelöltek' }))
  expect(await screen.findByText('Nincs több jelölt — az éjszakai kör hajnalban néz újra.')).toBeInTheDocument()
  expect(screen.getByText('‹ Kapcsolatok')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/me/people/jeloltek')
})

test('A köröm / Említések / Heti kép navigate to their exact future sibling paths (Task 3–5 own the pages)', () => {
  const { router: r1 } = renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'A köröm' }))
  expect(r1.state.location.pathname).toBe('/me/people/kor')

  const { router: r2 } = renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Említések' }))
  expect(r2.state.location.pathname).toBe('/me/people/emlitesek')

  const { router: r3 } = renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Heti kép' }))
  expect(r3.state.location.pathname).toBe('/me/people/heti')
})

test('Jelöltek carries no badge in S3 (no candidate source wired yet)', () => {
  renderPage()
  const tile = screen.getByRole('button', { name: 'Jelöltek' })
  expect(tile.querySelector('.ppl-hub-badge')).toBeNull()
})

test('A köröm shows a facepile of the first four people\'s initials', () => {
  renderPage()
  const tile = screen.getByRole('button', { name: 'A köröm' })
  const initials = [...tile.querySelectorAll('.ppl-fp-avat')].map((n) => n.textContent)
  expect(initials).toEqual(['P', 'B', 'Á', 'R'])
})

test('Említések carries the flagCount badge when > 0', () => {
  renderPage()
  const tile = screen.getByRole('button', { name: 'Említések' })
  expect(tile.querySelector('.ppl-hub-badge')?.textContent).toBe('2')
})

test('Mezo-sáv renders the derived sentence and hands off to a person-anchored conversation', () => {
  const { router } = renderPage()
  // Réka is trending down this week ⇒ the down-branch sentence wins.
  expect(screen.getByText(/Réka hangulata lejt az utóbbi hetekben/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Mezo · észrevétel/ }))
  expect(router.state.location.pathname).toBe('/mezo/chat')
  expect(router.state.location.search).toMatch(/^\?c=/)
})

test('the filter row and mention feed are gone from the hub (owned by the sibling pages now)', () => {
  const { container } = renderPage()
  expect(container.querySelector('.ppl-chiprow')).toBeNull()
  expect(container.querySelector('.ppl-mrowt')).toBeNull()
  expect(container.querySelector('.ppl-grid')).toBeNull()
})

test('header actions still open Log and Új személy (the existing PeoplePage sheets)', () => {
  renderPage()
  expect(screen.getByText('＋ Új személy')).toBeInTheDocument()
  fireEvent.click(screen.getByText(/Log/))
  expect(screen.getByText('Mit jegyzünk meg?')).toBeInTheDocument()
})

describe('Jelöltek route mounted directly', () => {
  test('the empty state renders the honest copy', () => {
    const router = createMemoryRouter(localRoutes, { initialEntries: ['/me/people/jeloltek'] })
    render(<RouterProvider router={router} />, { wrapper: QueryWrapper })
    expect(screen.getByText('Nincs több jelölt — az éjszakai kör hajnalban néz újra.')).toBeInTheDocument()
    expect(screen.getByText('‹ Kapcsolatok')).toBeInTheDocument()
  })
})
