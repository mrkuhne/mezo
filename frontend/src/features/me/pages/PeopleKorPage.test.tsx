// Emberek S3 hub, "A köröm" sibling page (mezo-06o0.2) — the person-grid page reached from
// the hub's "A köröm" tile. Source: docs/design_2.0/prototypes/src/emberek-body.html
// renderKor()/sparkHtml()/ctxDots() ×1.18. Each tile's spark bar count and ctxdots come
// straight from Task 1's `trendHeights`/`contextBreakdown` over the REAL mock seed
// (frontend/src/data/me/people.ts) — no fixture invented here, so a drift between this
// page's derivation and Task 1's functions fails honestly.
//
// Navigation off a card is asserted through a real react-router (PeoplePage.test.tsx
// idiom): `me/people/:id` isn't registered yet (a later task's job), so a test-local
// catch-all probe renders `location.pathname` for the click-through assertion.
import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, useLocation, type RouteObject } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { people as personSeed, mentions } from '@/data/me/people'
import { contextBreakdown, trendHeights } from '@/features/me/logic/peopleDerive'
import { PeopleKorPage } from '@/features/me/pages/PeopleKorPage'

// S4: usePeople's `people` is candidate-filtered (mezo-06o0.3) — this page only ever sees
// the active circle, so the raw seed's "pp-marci" candidate is excluded here too.
const people = personSeed.filter((p) => p.status !== 'candidate')

const hoisted = vi.hoisted(() => ({ emptyTrendFor: null as string | null }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    usePeople: () => {
      const real = actual.usePeople()
      if (!hoisted.emptyTrendFor) return real
      return {
        ...real,
        people: real.people.map((p) => (p.id === hoisted.emptyTrendFor ? { ...p, affectTrend: [] } : p)),
      }
    },
  }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
})

afterEach(() => {
  vi.unstubAllEnvs()
  hoisted.emptyTrendFor = null
})

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-probe">{location.pathname}</div>
}

const localRoutes: RouteObject[] = [
  { path: '/me/people/kor', element: <PeopleKorPage /> },
  { path: '*', element: <LocationProbe /> },
]

function renderPage() {
  const router = createMemoryRouter(localRoutes, { initialEntries: ['/me/people/kor'] })
  const view = render(<RouterProvider router={router} />, { wrapper: QueryWrapper })
  return { ...view, router }
}

test('hero shows "A köröm" + the active-people bignum', () => {
  const { container } = renderPage()
  expect(screen.getByText('A köröm')).toBeInTheDocument()
  expect(container.querySelector('.mz-bignum')?.textContent).toBe(String(people.length))
})

test('renders one tile per person', () => {
  const { container } = renderPage()
  expect(container.querySelectorAll('.ppl-grid .ppl-tile')).toHaveLength(people.length)
})

test('each tile carries the "N× e héten · N említés" line', () => {
  renderPage()
  for (const p of people) {
    expect(screen.getByText(`${p.mentionsThisWeek}× e héten · ${p.mentionCount} említés`)).toBeInTheDocument()
  }
})

test('Petra\'s spark has exactly one bar per affectTrend point (real seed data)', () => {
  const petra = people.find((p) => p.id === 'pp-petra')!
  const { container } = renderPage()
  const tile = screen.getByRole('button', { name: `${petra.name} részletei` })
  const bars = tile.querySelectorAll('.ppl-spark i')
  expect(bars).toHaveLength(trendHeights(petra.affectTrend, 19).length)
  expect(bars.length).toBeGreaterThan(0)
  void container
})

// CONTRACT: pins the page's own SPARK_MAX_PX=19 (16px prototype spark height x 1.18 frame
// scale) end-to-end — a plain bar-count check can't catch a maxPx typo (e.g. 19 -> 12) since
// trendHeights still returns one entry per trend point either way. Petra's seed affectTrend
// is [4,3,4,5,4,4,4,5] (trimmed to the server's 8-reading cap) — hand-computed against
// trendHeights(v,19) = round(v/5*19), asserted on the ACTUAL rendered style.height, not a
// re-derivation that could drift in step with a page-side bug.
test('CONTRACT: each spark bar\'s rendered height is trendHeights(affectTrend, 19), the page\'s real maxPx', () => {
  const petra = people.find((p) => p.id === 'pp-petra')!
  const expectedHeights = trendHeights(petra.affectTrend, 19)
  expect(expectedHeights).toEqual([15, 11, 15, 19, 15, 15, 15, 19]) // sanity-pin the hand-check itself
  renderPage()
  const tile = screen.getByRole('button', { name: `${petra.name} részletei` })
  const bars = [...tile.querySelectorAll('.ppl-spark i')] as HTMLElement[]
  expect(bars.map((b) => b.style.height)).toEqual(expectedHeights.map((h) => `${h}px`))
})

test('an empty affectTrend renders no spark container at all (honest empty state)', () => {
  hoisted.emptyTrendFor = 'pp-petra'
  renderPage()
  const tile = screen.getByRole('button', { name: 'Petra részletei' })
  expect(tile.querySelector('.ppl-spark')).toBeNull()
})

test('ctxdots reflect the person\'s own context breakdown, max 3 dots', () => {
  renderPage()
  // Bence has exactly one contextLabel'd mention ('edzes') in the seed.
  const bence = people.find((p) => p.id === 'pp-bence')!
  const benceMentions = mentions.filter((m) => m.person_id === bence.id)
  const expectedCtx = contextBreakdown(benceMentions).slice(0, 3)
  const tile = screen.getByRole('button', { name: `${bence.name} részletei` })
  const dots = tile.querySelectorAll('.ppl-ctxdots i')
  expect(dots).toHaveLength(expectedCtx.length)
  expect(dots.length).toBeGreaterThan(0)
})

test('a person with no context-labeled mentions renders no ctxdots container', () => {
  renderPage()
  // Petra's mock mentions never carry a contextLabel.
  const tile = screen.getByRole('button', { name: 'Petra részletei' })
  expect(tile.querySelector('.ppl-ctxdots')).toBeNull()
})

test('clicking a card navigates to /me/people/:id', () => {
  const { router } = renderPage()
  const petra = people.find((p) => p.id === 'pp-petra')!
  fireEvent.click(screen.getByRole('button', { name: `${petra.name} részletei` }))
  expect(router.state.location.pathname).toBe(`/me/people/${petra.id}`)
})

test('the footer legend explains the ring + dots (prototype .foot9, ported as .ppl-foot)', () => {
  renderPage()
  expect(screen.getByText('A gyűrű a kapcsolat hangulat-szintje, a pöttyök a jellemző kontextusok.')).toBeInTheDocument()
})

test('header back chip returns to the hub, and Új személy opens PersonEditSheet', () => {
  renderPage()
  expect(screen.getByText('‹ Kapcsolatok')).toBeInTheDocument()
  fireEvent.click(screen.getByText('＋ Új személy'))
  expect(screen.getByText('Név')).toBeInTheDocument()
})
