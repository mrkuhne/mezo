import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { EnHubPage } from '@/features/me/pages/EnHubPage'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { addDays, localDateString, mondayOf } from '@/shared/lib/dates'

// Én hub — „Hol tartok" (mezo-lhqw7): the /me index composes four units (identity strip → week
// hero → Életvonal → Célok állása) above the Fejlődés / Emberek tiles and the wide Rutin tile.
// Each unit owns its hooks and its honest states, and has its own test file under
// components/hub/; THIS file asserts the composition: the order, what left the hub (the Súly /
// Alvás / Célok / Napló tiles are bottom-bar tabs now, the bio line lives on the Test tab), and
// that everything the old hub linked to is still reachable.
//
// Every test runs in BOTH modes with no pin: the mock run reads the seeds, the real run
// (`VITE_USE_MOCK=false`) signs in (`setToken`) and reads the repo's MSW handlers, with the weight
// log re-dated into the Életvonal's 12-week window. Assertions are therefore about structure,
// never about a seed's numbers — those live in the units' own tests. Only the Rutin tile's two
// hooks are stubbed, as before.
const REAL = import.meta.env.VITE_USE_MOCK === 'false'
const MON = mondayOf(localDateString())
/** Four measured weeks ending this week — enough for a curve in real mode. */
const WEIGHT_LOG = [3, 2, 1, 0].map((w, i) => ({ id: `w${i}`, date: addDays(MON, -7 * w), value: 80.4 - i * 0.3, note: null }))
const useHabitDay = vi.hoisted(() => vi.fn())
const useHabitSummary = vi.hoisted(() => vi.fn())

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useHabitDay, useHabitSummary }
})

beforeEach(() => {
  if (REAL) {
    setToken('t')
    server.use(http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json(WEIGHT_LOG)))
  }
  useHabitDay.mockReturnValue({
    habits: [
      { key: 'morning-1', chain: 'MORNING', status: 'done' },
      { key: 'morning-2', chain: 'MORNING', status: 'pending' },
      { key: 'evening-1', chain: 'EVENING', status: 'pending' },
    ],
  })
  useHabitSummary.mockReturnValue({
    data: {
      perfectMorningDays30: 0,
      perfectEveningDays30: 0,
      habits: [
        { key: 'morning-1', strengthPct: 82, done28: 0, missed28: 0 },
        { key: 'morning-2', strengthPct: 82, done28: 0, missed28: 0 },
        { key: 'evening-1', strengthPct: 64, done28: 0, missed28: 0 },
      ],
    },
  })
})

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <div data-testid="loc">{pathname + search}</div>
}

function renderHub() {
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/me']}>
          <>
            <Routes>
              <Route path="/me" element={<EnHubPage />} />
              <Route path="*" element={null} />
            </Routes>
            <LocationProbe />
          </>
        </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}

/** `a` precedes `b` in document order. */
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

test('the hub reads top to bottom: identity strip → week hero → Életvonal → Célok állása → Fejlődés, Emberek', async () => {
  renderHub()
  const strip = await screen.findByRole('button', { name: /· Fejlődés$/ })
  const goals = await screen.findByRole('button', { name: 'Célok állása' })
  await waitFor(() => expect(document.querySelector('.enh-elv-curve')).not.toBeNull())
  const hero = document.querySelector('.enh-wkhero')!
  const lifeline = document.querySelector('.enh-elv')!
  const growth = screen.getByRole('button', { name: 'Fejlődés' })
  const people = screen.getByRole('button', { name: 'Emberek' })
  const order = [strip, hero, lifeline, goals, growth, people]
  for (const el of order) expect(el).not.toBeNull()
  for (let i = 1; i < order.length; i++) expect(before(order[i - 1], order[i])).toBe(true)
})

test('the ranking: the week hero is the one frameless halo, the strip is flat, the cards and tiles are glass', async () => {
  renderHub()
  const strip = await screen.findByRole('button', { name: /· Fejlődés$/ })
  expect(strip).not.toHaveClass('glass')
  expect(strip).toHaveAttribute('data-kalauz-anchor', 'me-idhero')
  expect(document.querySelector('.enh-wkhero')).toHaveClass('uv-halo')
  expect(document.querySelector('.enh-wkhero')).not.toHaveClass('glass')
  await waitFor(() => expect(document.querySelector('.enh-elv-curve')).not.toBeNull())
  expect(document.querySelector('.enh-elv')).toHaveClass('glass')
  expect(await screen.findByRole('button', { name: 'Célok állása' })).toHaveClass('glass')
  const ART: [string, string][] = [['Fejlődés', '#t-up'], ['Emberek', '#t-people'], ['Rutin', '#t-chain']]
  for (const [label, href] of ART) {
    const tile = screen.getByRole('button', { name: label })
    expect(tile).toHaveClass('glass')
    expect(tile.querySelector('.mz-spotwrap use')?.getAttribute('href')).toBe(href)
  }
  // never glass inside glass, never a control inside a control
  expect(document.querySelectorAll('.glass .glass')).toHaveLength(0)
  expect(document.querySelectorAll('button button')).toHaveLength(0)
})

test('the Súly, Alvás, Célok and Napló tiles left the hub — they are tabs now; Rutin stays', async () => {
  renderHub()
  await screen.findByRole('button', { name: 'Fejlődés' })
  for (const label of ['Súly', 'Alvás', 'Célok', 'Napló', 'Growth']) {
    expect(screen.queryByRole('button', { name: label })).toBeNull()
  }
  expect(document.querySelectorAll('.mz-tile')).toHaveLength(3)
  expect(screen.getByRole('button', { name: 'Rutin' })).toBeInTheDocument()
})

test('the retired identity hero, its XP ring and the bio line are gone from the hub', async () => {
  renderHub()
  await screen.findByRole('button', { name: 'Fejlődés' })
  expect(document.querySelector('.enh-idhero, .enh-idring, .enh-bio, .ent-bio')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Biometria szerkesztése' })).toBeNull()
})

// Reverse parity: everything the old hub opened is still one tap away. The hub unmounts on
// navigation, so each door gets a fresh render.
test('every door of the hub opens its own page', async () => {
  const DOORS: [string | RegExp, string][] = [
    [/· Fejlődés$/, '/me/growth'],          // level · XP · streak · coins · title live there
    ['A heti elemzés ›', '/me/week?start='],
    ['Célok állása', '/me/goals'],
    ['Fejlődés', '/me/growth'],
    ['Emberek', '/me/people'],
    ['Rutin', '/me/rutin'],
  ]
  for (const [name, path] of DOORS) {
    const { unmount } = renderHub()
    await userEvent.click(await screen.findByRole('button', { name }))
    expect(screen.getByTestId('loc').textContent).toContain(path)
    unmount()
  }
  renderHub()
  await waitFor(() => expect(document.querySelector('button.enh-elv-next')).not.toBeNull())
  await userEvent.click(document.querySelector<HTMLButtonElement>('button.enh-elv-next')!)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
})

test('shows today done/total and both chain strengths on the Rutin tile', async () => {
  renderHub()
  const rutin = await screen.findByRole('button', { name: 'Rutin' })
  expect(rutin).toHaveTextContent('1 / 3 ma')
  expect(rutin).toHaveTextContent('reggel 82%')
  expect(rutin).toHaveTextContent('este 64%')
})

test('shows no fabricated line on the Rutin tile when the user has no habits', async () => {
  useHabitDay.mockReturnValue({ habits: [] })
  useHabitSummary.mockReturnValue({ data: { perfectMorningDays30: 0, perfectEveningDays30: 0, habits: [] } })
  renderHub()
  const rutin = await screen.findByRole('button', { name: 'Rutin' })
  expect(rutin.querySelector('.mz-tile-line')).toBeNull()
})

test('a beállítások közös fejléc-bejárata mellett nincs helyi csempe', () => {
  renderHub()
  expect(screen.queryByRole('button', { name: 'Beállítások' })).toBeNull()
})

test('the entrance choreography is armed — every .rise sits inside .mz-play', async () => {
  const { container } = renderHub()
  await screen.findByRole('button', { name: 'Fejlődés' })
  const rises = container.querySelectorAll('.rise')
  expect(rises.length).toBeGreaterThan(0)
  for (const r of rises) expect(r.closest('.mz-play')).not.toBeNull()
})

// S2 (mezo-qw37.2): the identity is the SIGNED-IN account, not a seed. `useProfile` is
// deliberately not stubbed, so this walks the real hook → useMe() → MSW /api/auth/me.
test('real mode: the identity strip shows the account name from /api/auth/me', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderHub()
  await waitFor(() => expect(document.querySelector('.enh-idnm strong')).toHaveTextContent('Owner'))
  expect(document.querySelector('.enh-idmono')).toHaveTextContent('O')
  expect(screen.getByRole('button', { name: 'Owner · Fejlődés' })).toBeInTheDocument()
})

// The real-mode gate for the composition (fix round 1): a cold load must already be the five
// blocks in order, with no control inside a control, and the Életvonal must NOT claim „még kevés
// a mérés" while its weight log is still on the wire.
test('real mode: five blocks in order, no nested buttons, and no empty-state copy before the weight log resolves', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  server.use(http.get(`${API_BASE}/api/biometrics/weight`, async () => {
    await gate
    return HttpResponse.json(WEIGHT_LOG)
  }))
  const { container } = renderHub()

  // everything else has landed, the weight log has not
  const goals = await screen.findByRole('button', { name: 'Célok állása' })
  const strip = await screen.findByRole('button', { name: 'Owner · Fejlődés' })
  expect(screen.getByTestId('enh-elv-skeleton')).toBeInTheDocument()
  expect(screen.queryByText(/Még kevés a mérés/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Mérj most' })).toBeNull()
  // the weight-goal row, if the fixture has one, shows no percentage yet
  expect(container.querySelector('.enh-grow .uv-bar')).toBeNull()

  const blocks = () => [
    strip, container.querySelector('.enh-wkhero')!, container.querySelector('.enh-elv')!, goals,
    screen.getByRole('button', { name: 'Fejlődés' }),
  ]
  for (const el of blocks()) expect(el).not.toBeNull()
  for (let i = 1; i < blocks().length; i++) expect(before(blocks()[i - 1], blocks()[i])).toBe(true)
  expect(container.querySelector('button button')).toBeNull()

  release()
  await waitFor(() => expect(container.querySelector('.enh-elv-curve')).not.toBeNull())
  expect(screen.queryByTestId('enh-elv-skeleton')).toBeNull()
  expect(screen.queryByText(/Még kevés a mérés/)).toBeNull()
  for (let i = 1; i < blocks().length; i++) expect(before(blocks()[i - 1], blocks()[i])).toBe(true)
  expect(container.querySelector('button button')).toBeNull()
})

test('real mode: a failed weight-log read is a retryable error on the Életvonal, not the empty state', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  server.use(http.get(`${API_BASE}/api/biometrics/weight`, () => new HttpResponse(null, { status: 500 })))
  renderHub()
  expect(await screen.findByText('Nem sikerült betölteni a súlynaplót.')).toBeInTheDocument()
  expect(screen.queryByText(/Még kevés a mérés/)).toBeNull()
})

// mezo-rn9u: with no goal at all the hub must not dead-end. The permanent door to the Célok
// hub is the bottom bar's Célok tab now (app/navigation tests); on the hub itself the standing
// card honestly gives way to the dashed door into the wizard.
test('real mode, no goal of any kind: the dashed „＋ Első cél" door replaces the standing card', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  server.use(
    http.get(`${API_BASE}/api/life-goals`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])),
  )
  renderHub()
  const door = await screen.findByRole('button', { name: /＋ Első cél/ })
  expect(door).toHaveClass('uv-empty')
  expect(door).not.toHaveClass('glass')
  expect(screen.queryByRole('button', { name: 'Célok állása' })).toBeNull()
  await userEvent.click(door)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/goals/new')
})

test('real mode: a failed life-goals read never offers the „＋ Első cél" door', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  server.use(
    http.get(`${API_BASE}/api/life-goals`, () => new HttpResponse(null, { status: 500 })),
    http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])),
  )
  renderHub()
  await screen.findByRole('button', { name: 'Owner · Fejlődés' })
  await waitFor(() => expect(document.querySelector('.enh-elv-curve, .enh-elv-empty, .enh-elv-err')).not.toBeNull())
  expect(screen.queryByRole('button', { name: /Első cél/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Célok állása' })).toBeNull()
})
