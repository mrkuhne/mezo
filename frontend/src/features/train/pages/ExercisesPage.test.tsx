import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { delay, http, HttpResponse } from 'msw'
import { ExercisesPage } from '@/features/train/pages/ExercisesPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// The Titanium catalogue (parity P2 Task 4, mezo-lf3cv) — the retired page's top-5 shell
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

const cards = () => Array.from(document.querySelectorAll<HTMLElement>('.gy-card'))

test('the poster carries the prototype eyebrow, title and lead verbatim', async () => {
  const { container } = renderPage()
  await screen.findByText('A mozdulataid')
  const hero = container.querySelector('.gyx-hero')!
  expect(within(hero as HTMLElement).getByText('Gyakorlatok')).toBeInTheDocument()
  expect(within(hero as HTMLElement).getByText(
    'Minden gyakorlat egy helyen — a rekordjaiddal és a medáljaiddal együtt.',
  )).toBeInTheDocument()
})

test('the poster foot shows three REAL counts (katalógus · rekordos sorok · medálok)', async () => {
  const { container } = renderPage()
  await screen.findByText('A mozdulataid')
  const foot = container.querySelector('.gyx-foot')!
  // 6 catalogue rows; 3 of them carry a record (Dead Hang's record has no catalogue row);
  // 2 medals land on catalogue rows (Leg Press's medal has no catalogue row).
  expect(foot.textContent).toBe('6 gyakorlat3 rekorddal2 medál')
})

test('the counts stay honest at zero — an empty catalogue says 0 of everything', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/exercises`, () => HttpResponse.json([])),
  )
  const { container } = renderPage()
  await screen.findByText('A mozdulataid')
  expect(container.querySelector('.gyx-foot')!.textContent).toBe('0 gyakorlat0 rekorddal0 medál')
  expect(screen.getByText('Nincs ilyen gyakorlat a tárban.')).toBeInTheDocument()
})

test('one card per catalogue exercise: art, name, muscle label', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  expect(cards()).toHaveLength(6)
  const row = cards().find((c) => c.textContent?.includes('Chest Supported Row'))!
  expect(within(row).getByText('Hát (közép)')).toBeInTheDocument()
  expect(row.querySelector('.muscle-chip')).toBeTruthy()
})

test('a logged exercise shows its estimated 1RM and its medal count', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  const row = cards().find((c) => c.textContent?.includes('Chest Supported Row'))!
  const best = row.querySelector('.gy-card-best')!
  expect(within(best as HTMLElement).getByText('133,3 kg')).toBeInTheDocument()
  expect(within(best as HTMLElement).getByText('becsült 1RM')).toBeInTheDocument()
  expect(row.querySelector('.gy-medals')!.textContent).toContain('1')
})

test('a logged exercise with an e1RM but no medals shows no medal segment at all — never a bare 0 (parity P2)', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/medals`, () => HttpResponse.json({ medals: [] })),
  )
  renderPage()
  await screen.findByText('A mozdulataid')
  const row = cards().find((c) => c.textContent?.includes('Chest Supported Row'))!
  const best = row.querySelector('.gy-card-best')!
  expect(within(best as HTMLElement).getByText('133,3 kg')).toBeInTheDocument()
  expect(row.querySelector('.gy-medals')).toBeNull()
  expect(within(row).queryByText('0')).toBeNull()
})

test('a logged exercise with an e1RM and a medal shows the medal segment (parity P2)', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  const row = cards().find((c) => c.textContent?.includes('Chest Supported Row'))!
  expect(row.querySelector('.gy-medals')).not.toBeNull()
  expect(row.querySelector('.gy-medals')!.textContent).toContain('1')
})

test('a logged exercise with no trustworthy estimate shows an em dash, never a zero', async () => {
  renderPage()
  await screen.findByText('A mozdulataid')
  // Box Jump is logged (plyo, 6 sessions) but carries no bestE1rm.
  const row = cards().find((c) => c.textContent?.includes('Box Jump'))!
  expect(within(row).getByText('—')).toBeInTheDocument()
  expect(within(row).queryByText('még nincs naplózva')).toBeNull()
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
  expect(within(row).getByText('még nincs naplózva')).toBeInTheDocument()
  expect(row.querySelector('.gy-card-best')).toBeNull()
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

test('the poster foot’s medal count is a doorway to the medal vitrine — the other two facts are not (fix round 1)', async () => {
  const user = userEvent.setup()
  const { container } = renderPage()
  await screen.findByText('A mozdulataid')
  const foot = container.querySelector('.gyx-foot')!

  // Only the medal segment is a button; „gyakorlat" and „rekorddal" stay plain text.
  expect(within(foot as HTMLElement).getAllByRole('button')).toHaveLength(1)

  const medalLink = within(foot as HTMLElement).getByRole('button', { name: /medál/ })
  expect(medalLink).toHaveAccessibleName('2 medál · a medálvitrinbe')
  await user.click(medalLink)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/medals')
})

test('a quiet „＋ Új gyakorlat" row at the list’s foot opens the creation sheet (fix round 1)', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('A mozdulataid')
  expect(screen.queryByLabelText('Név')).toBeNull()

  await user.click(screen.getByRole('button', { name: '＋ Új gyakorlat' }))
  expect(await screen.findByLabelText('Név')).toBeInTheDocument()
  expect(screen.getByLabelText('Videó URL')).toBeInTheDocument()
  // Create mode only — no delete affordance reachable from here (Task 5's, not this door's).
  expect(screen.queryByRole('button', { name: 'Gyakorlat törlése' })).toBeNull()
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

// Üvegesítés (mezo-me75u.4, prototypes/uveg-edzes.html#exercises): the ranking, not the paint.
test('üveg: a halo hero with the 3D t-muscle art, glass cards tinted by their own muscle, t-record medal counts', async () => {
  const { container } = renderPage()
  await screen.findByText('A mozdulataid')
  const hero = container.querySelector('.gyx-hero')!
  expect(hero).toHaveClass('uv-halo')
  expect(hero).not.toHaveClass('glass')
  expect(hero.querySelector('use')!.getAttribute('href')).toBe('#t-muscle')
  for (const card of cards()) {
    expect(card).toHaveClass('glass')
    // the hue is published on the element that wears the glass (bible U1 rule 4)
    expect(card.style.getPropertyValue('--c')).not.toBe('')
    expect(card.querySelector('.glass')).toBeNull()
  }
  const row = cards().find((c) => c.textContent?.includes('Chest Supported Row'))!
  expect(row.querySelector('.gy-medals use')!.getAttribute('href')).toBe('#t-record')
  // the region chips are flat pills; the active one says so to assistive tech too
  const chips = screen.getByRole('group', { name: 'Izomcsoport-szűrő' })
  expect(within(chips).getByRole('button', { name: 'Mind' })).toHaveClass('is-on')
  expect(chips.querySelector('.glass')).toBeNull()
})
