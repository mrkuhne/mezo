// Emberek S3 hub (mezo-06o0.2) — PeoplePage becomes the Kapcsolatok hub: a hero + 3-cell
// stat strip + 4 navigation tiles (Jelöltek / A köröm / Említések / Heti kép, each a sibling
// page — WeekHub precedent, never a local show/hide) + the Mezo-band chat handoff.
// `now` is pinned to the mock seed's own "today" (2026-05-24) so hubLines' shared
// `weekWindow` (newest-mention-anchored, not `now`-anchored) lands on a known,
// hand-checked set of mentions (see data/me/people.ts) instead of drifting with the real
// clock. The newest mock mention is 2026-05-24T09:00 (mn-auto1), so the window's cutoff
// is 2026-05-17T09:00 — the same cutoff PeopleEmlitesekPage.test.tsx/PeopleHetiPage.test.tsx
// hand-check, dropping only the 2026-05-15 mention (Márk) from the week: 10 mentions.
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
import { mezoNote as mezoNoteSeed } from '@/data/me/people'

const NOW = new Date('2026-05-24T12:00:00')

// Flattens every person's `direction` so nobody trends down/up — exercises the honest
// '—' fallback (statstrip down-cell), which the always-has-a-down-person mock seed can
// never reach on its own. `emptyMezoNote` separately blanks `mezoNote` (real mode before
// any data) to exercise the band's own honest "omit the whole band" empty state — the two
// are independent knobs because `mezoNote` is a server-computed field the hub just
// displays verbatim, not something the FE derives from `direction` any more.
const hoisted = vi.hoisted(() => ({ flattenTrends: false, empty: false, noCandidates: false, emptyMezoNote: false }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    usePeople: () => {
      const real = actual.usePeople()
      if (hoisted.empty) return { ...real, people: [], mentions: [], candidates: [], mezoNote: '' }
      if (hoisted.noCandidates) return { ...real, candidates: [] }
      if (hoisted.emptyMezoNote) return { ...real, mezoNote: '' }
      if (!hoisted.flattenTrends) return real
      return { ...real, people: real.people.map((p) => ({ ...p, direction: 'flat' as const, directionReason: null })) }
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
  hoisted.noCandidates = false
  hoisted.emptyMezoNote = false
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
  expect(screen.getByText('aktív kör · 10 említés e héten')).toBeInTheDocument()
})

test('statstrip: 3 cells — mentions·week, top name, down name (or em dash)', () => {
  const { container } = renderPage()
  const cells = container.querySelectorAll('.mz-statcell')
  expect(cells).toHaveLength(3)
  expect(cells[0].querySelector('b')?.textContent).toBe('10')
  expect(cells[0].querySelector('small')?.textContent).toBe('említés · hét')
  expect(cells[1].querySelector('b')?.textContent).toBe('Petra')
  expect(cells[1].querySelector('small')?.textContent).toBe('legtöbbet említett')
  // Bence is the seed's only down-trending active person (his 8-reading affectTrend,
  // trimmed to the server's cap, genuinely trends down under the server rule).
  expect(cells[2].querySelector('b')?.textContent).toBe('Bence ↘')
  expect(cells[2].querySelector('small')?.textContent).toBe('hangulat-lejtő')
})

test('CONTRACT: the down-cell reads em dash — never a fabricated name — when nobody trends down', () => {
  hoisted.flattenTrends = true
  const { container } = renderPage()
  const cells = container.querySelectorAll('.mz-statcell')
  expect(cells[2].querySelector('b')?.textContent).toBe('—')
})

test('CONTRACT: the Mezo-band renders usePeople().mezoNote verbatim (mock seed), never an FE-templated sentence', () => {
  renderPage()
  expect(screen.getByText(mezoNoteSeed)).toBeInTheDocument()
})

test('the Mezo-band is OMITTED entirely when mezoNote is empty (real mode before any data) — never an empty snippet', () => {
  hoisted.emptyMezoNote = true
  renderPage()
  expect(screen.queryByText(/Mezo · észrevétel/)).toBeNull()
  expect(document.querySelector('.ppl-hub-wide')).toBeNull()
})

test('the Jelöltek tile navigates, through the REAL app router, to the real empty-state page (one continuous flow)', async () => {
  // Uses the app's own `routes` (from @/app/router) — a drift between the tile's
  // `navigate('/me/people/jeloltek')` and the router's own registration of that path
  // would fail this test, unlike a mocked `useNavigate` assertion. No-candidate override
  // keeps this test about the routing, not the S4 candidate-card content (own file's job).
  hoisted.noCandidates = true
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

test('Jelöltek carries the candidate-count badge and names the candidate on the tile-line', () => {
  renderPage()
  const tile = screen.getByRole('button', { name: 'Jelöltek' })
  expect(tile.querySelector('.ppl-hub-badge')?.textContent).toBe('1')
  expect(screen.getByText('Marci · visszatérő név')).toBeInTheDocument()
})

test('Jelöltek carries no badge and reads the honest quiet line when there is no candidate', () => {
  hoisted.noCandidates = true
  renderPage()
  const tile = screen.getByRole('button', { name: 'Jelöltek' })
  expect(tile.querySelector('.ppl-hub-badge')).toBeNull()
  expect(screen.getByText('nincs új arc — az éjszakai kör figyel')).toBeInTheDocument()
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

test('Mezo-sáv renders mezoNote and hands off to a person-anchored conversation', () => {
  const { router } = renderPage()
  expect(screen.getByText(mezoNoteSeed)).toBeInTheDocument()
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
  test('the empty state renders the honest copy when there is no candidate', () => {
    hoisted.noCandidates = true
    const router = createMemoryRouter(localRoutes, { initialEntries: ['/me/people/jeloltek'] })
    render(<RouterProvider router={router} />, { wrapper: QueryWrapper })
    expect(screen.getByText('Nincs több jelölt — az éjszakai kör hajnalban néz újra.')).toBeInTheDocument()
    expect(screen.getByText('‹ Kapcsolatok')).toBeInTheDocument()
  })
})
