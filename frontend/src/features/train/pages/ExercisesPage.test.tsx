import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { delay, http, HttpResponse } from 'msw'
import { ExercisesPage } from '@/features/train/pages/ExercisesPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// The catalogue in the Folyadék look (mezo-n4wf5.3; behaviour from parity P2 Task 4, mezo-lf3cv) — the retired page's top-5 shell
// („Top gyakorlatok · rekordjaid", the dashed ghost rows, the ⋯/▶ sheets) is gone, so this
// suite was rewritten from scratch rather than extended.
//
// Real-mode view: catalogue (6 rows), records (Chest Supported Row + Box Jump by catalogId,
// Hip Thrust name-grouped, Dead Hang for an exercise NOT in the catalogue) and medals
// (Chest Supported Row + Hip Thrust in the catalogue, Leg Press outside it) all come from
// the MSW fixtures.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="loc">{pathname}</div>
}

const renderPage = () =>
  render(
    <QueryWrapper>
      <MemoryRouter>
        <ExercisesPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )

const cards = () => Array.from(document.querySelectorAll<HTMLElement>('.er-list .fo-row'))
const hero = () => document.querySelector<HTMLElement>('.fo-hero')!

test('the hero carries the label, the verdict with the two REAL counts, and the lead verbatim', async () => {
  renderPage()
  expect(await screen.findByText('A mozdulataid')).toHaveClass('fo-hero-lbl')
  // 6 catalogue rows; 3 of them carry a record (Dead Hang's record has no catalogue row).
  expect(within(hero()).getByText('6 gyakorlat, 3 rekorddal.')).toHaveClass('fo-hero-verdict')
  expect(within(hero()).getByText(
    'Minden gyakorlat egy helyen — a rekordjaiddal és a medáljaiddal együtt.',
  )).toBeInTheDocument()
})

test('the hero graphic is the kettlebell filled to the share of exercises with a record', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  const fill = hero().querySelector('.fo-hero-left svg.fo-fill')
  expect(fill).not.toBeNull()
  // 3 of 6 → the liquid's surface stands at half height (viewBox 0 0 100 100)
  expect(fill!.querySelector('.fo-fill-wv path')!.getAttribute('d')).toMatch(/^M-100 50 /)
})

test('the counts stay honest at zero — an empty catalogue says 0 of everything', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/exercises`, () => HttpResponse.json([])),
  )
  renderPage()
  await screen.findByText('A mozdulataid')
  expect(within(hero()).getByText('0 gyakorlat, 0 rekorddal.')).toBeInTheDocument()
  expect(within(hero()).getByRole('button', { name: /medál/ })).toHaveTextContent('0 medál')
  expect(screen.getByText('Nincs ilyen gyakorlat a tárban.')).toBeInTheDocument()
})

test('one row per catalogue exercise: muscle chip, name, muscle label', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  expect(cards()).toHaveLength(6)
  const row = cards().find((c) => c.textContent?.includes('Chest Supported Row'))!
  expect(row.querySelector('small')).toHaveTextContent(/^Hát \(közép\)/)
  expect(row.querySelector('.ex-mchp .muscle-chip')).toBeTruthy()
})

test('a logged exercise shows its estimated 1RM and its medal count', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  const row = cards().find((c) => c.textContent?.includes('Chest Supported Row'))!
  expect(row.querySelector('.v')).toHaveTextContent('133,3 kg')
  expect(row.querySelector('small')).toHaveTextContent('Hát (közép) · becsült 1RM · 1 medál')
  // …and its level against the catalogue's strongest estimate
  expect(row.querySelector('.fo-rowbar .fo-level')).not.toBeNull()
})

test('a logged exercise with an e1RM but no medals shows no medal segment at all — never a bare 0 (parity P2)', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/medals`, () => HttpResponse.json({ medals: [] })),
  )
  renderPage()
  await screen.findByText('A mozdulataid')
  const row = cards().find((c) => c.textContent?.includes('Chest Supported Row'))!
  expect(row.querySelector('.v')).toHaveTextContent('133,3 kg')
  expect(row.querySelector('small')!.textContent).toBe('Hát (közép) · becsült 1RM')
  expect(row.textContent).not.toMatch(/medál/)
})

test('a logged exercise with an e1RM and a medal shows the medal segment (parity P2)', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  const row = cards().find((c) => c.textContent?.includes('Chest Supported Row'))!
  expect(row.querySelector('small')!.textContent).toMatch(/ · 1 medál$/)
})

test('a logged exercise with no trustworthy estimate shows an em dash, never a zero', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  // Box Jump is logged (plyo, 6 sessions) but carries no bestE1rm.
  const row = cards().find((c) => c.textContent?.includes('Box Jump'))!
  expect(row.querySelector('.v')).toHaveTextContent('—')
  expect(row.textContent).not.toMatch(/még nincs naplózva/)
  // no estimate → no level to draw
  expect(row.querySelector('.fo-level')).toBeNull()
})

test('a name-grouped record still attaches to its catalogue row', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  // The Hip Thrust record carries NO catalogId; its catalogue row does (mezo-u5gk).
  const row = cards().find((c) => c.textContent?.includes('Hip Thrust'))!
  expect(within(row).getByText('160 kg')).toBeInTheDocument()
})

test('an unlogged exercise says „még nincs naplózva"', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  const row = cards().find((c) => c.textContent?.includes('Lateral Raise'))!
  expect(row.querySelector('small')).toHaveTextContent(/ · még nincs naplózva$/)
  expect(row.querySelector('.v')).toBeNull()
  expect(row.querySelector('.fo-level')).toBeNull()
})

test('search matches the name, the muscle label, and is accent-blind', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('A mozdulataid')
  const field = screen.getByLabelText('Keresés a gyakorlatok között')
  expect(field).toHaveAttribute('placeholder', 'Keresés névre vagy izomra…')

  await user.type(field, 'lateral')
  expect(cards().map((c) => c.querySelector('strong')!.textContent)).toEqual(['Lateral Raise'])

  await user.clear(field)
  await user.type(field, 'hat') // „Hát (közép)" typed without the accent
  expect(cards().map((c) => c.querySelector('strong')!.textContent)).toEqual(['Chest Supported Row'])

  await user.clear(field)
  await user.type(field, 'zzz')
  expect(cards()).toHaveLength(0)
  expect(screen.getByText('Nincs ilyen gyakorlat a tárban.')).toBeInTheDocument()
})

test('the chips are Mind + one per region the catalogue has, and they filter', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('A mozdulataid')
  const chips = screen.getByRole('group', { name: 'Izomcsoport-szűrő' })
  expect(within(chips).getAllByRole('button').map((b) => b.textContent))
    .toEqual(['Mind', 'Hát', 'Váll', 'Láb', 'Core'])

  await user.click(within(chips).getByRole('button', { name: 'Láb' }))
  // sage = Hip Thrust (glute), Box Jump (quad), Standing Calf Raise (calf)
  expect(cards().map((c) => c.querySelector('strong')!.textContent))
    .toEqual(['Hip Thrust', 'Box Jump', 'Standing Calf Raise'])

  await user.click(within(chips).getByRole('button', { name: 'Mind' }))
  expect(cards()).toHaveLength(6)
})

test('tapping a card opens that exercise’s story route', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('A mozdulataid')
  // No `aria-label` on the card any more (fix round 1) — its accessible name is now
  // built from its own visible text, so this matches on a fragment rather than the
  // exact `name · muscleLabel` string the old override produced.
  await user.click(screen.getByRole('button', { name: /Box Jump/ }))
  expect(screen.getByTestId('loc'))
    .toHaveTextContent('/train/exercises/f1e3a0e2-0000-4000-8000-000000000072')
})

test('a card’s accessible name carries its e1RM, its medal count and the empty state — never overridden (fix round 1)', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  // Chest Supported Row: logged, 133,3 kg, 1 medal — an overriding `aria-label` used to
  // hide all of this from a screen reader.
  const logged = screen.getByRole('button', {
    name: (n) => n.includes('Chest Supported Row') && n.includes('133,3 kg') && n.includes('becsült 1RM'),
  })
  expect(logged).toBeInTheDocument()
  // Lateral Raise: never logged.
  const empty = screen.getByRole('button', {
    name: (n) => n.includes('Lateral Raise') && n.includes('még nincs naplózva'),
  })
  expect(empty).toBeInTheDocument()
})

test('the hero’s medal button is the doorway to the medal vitrine (fix round 1)', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('A mozdulataid')
  // 2 medals land on catalogue rows (Leg Press's medal has no catalogue row).
  const medalLink = within(hero()).getByRole('button', { name: /medál/ })
  expect(medalLink).toHaveTextContent('2 medál')
  expect(medalLink).toHaveAccessibleName('2 medál · a medálvitrinbe')
  await user.click(medalLink)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/medals')
})

test('„＋ Új gyakorlat" stands on the hero and at the list’s foot; both open the creation sheet (fix round 1)', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('A mozdulataid')
  expect(screen.queryByLabelText('Név')).toBeNull()

  const doors = screen.getAllByRole('button', { name: '＋ Új gyakorlat' })
  expect(doors).toHaveLength(2)
  expect(hero()).toContainElement(doors[0])
  expect(hero()).not.toContainElement(doors[1])
  for (const door of doors) {
    await user.click(door)
    expect(await screen.findByLabelText('Név')).toBeInTheDocument()
    expect(screen.getByLabelText('Videó URL')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Új gyakorlat' })).toBeInTheDocument()
    // Create mode only — no delete affordance reachable from here.
    expect(screen.queryByRole('button', { name: 'Gyakorlat törlése' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Mégse' }))
    await waitFor(() => expect(screen.queryByLabelText('Név')).toBeNull())
  }
})

test('the medals query’s own pending state is folded into the skeleton gate — no fake „0 medál" while it loads (fix round 1)', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/medals`, async () => {
      await delay(50)
      return HttpResponse.json([])
    }),
  )
  renderPage()
  // The catalogue/records resolve fast; the skeleton must still hold while medals lags.
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  await screen.findByText('A mozdulataid')
  expect(screen.queryByRole('status', { name: 'Betöltés…' })).not.toBeInTheDocument()
})

// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `exercises()`): the structure, not the paint.
test('folyadék: hero → 1 Keresés és szűrés → 2 Lista, kit rows on white cards, the old skin is gone', async () => {
  const { container } = renderPage()
  await screen.findByText('A mozdulataid')
  expect(container.querySelector('.fo-page')).not.toBeNull()
  expect(Array.from(container.querySelectorAll('.fo-sec')).map((h) => h.textContent))
    .toEqual(['1Keresés és szűrés', '2Lista'])
  for (const card of cards()) expect(card.closest('.fo-card')).not.toBeNull()
  expect(container.querySelector('.glass, [class*="gyx-"], [class*="gy-card"], [class*="uv-"], .mz-play')).toBeNull()
  // the region pills say their state to assistive tech
  const chips = screen.getByRole('group', { name: 'Izomcsoport-szűrő' })
  expect(within(chips).getByRole('button', { name: 'Mind' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(chips).getByRole('button', { name: 'Láb' })).toHaveAttribute('aria-pressed', 'false')
})
