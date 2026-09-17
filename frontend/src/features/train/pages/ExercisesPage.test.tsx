import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
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
  const hero = container.querySelector('.pl-dhero')!
  expect(within(hero as HTMLElement).getByText('Gyakorlatok')).toBeInTheDocument()
  expect(within(hero as HTMLElement).getByText(
    'Minden gyakorlat egy helyen — a rekordjaiddal és a medáljaiddal együtt.',
  )).toBeInTheDocument()
})

test('the poster foot shows three REAL counts (katalógus · rekordos sorok · medálok)', async () => {
  const { container } = renderPage()
  await screen.findByText('A mozdulataid')
  const foot = container.querySelector('.pl-poster-foot')!
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
  expect(container.querySelector('.pl-poster-foot')!.textContent).toBe('0 gyakorlat0 rekorddal0 medál')
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
  await user.click(screen.getByRole('button', { name: 'Box Jump · Comb' }))
  expect(screen.getByTestId('loc'))
    .toHaveTextContent('/train/exercises/f1e3a0e2-0000-4000-8000-000000000072')
})
