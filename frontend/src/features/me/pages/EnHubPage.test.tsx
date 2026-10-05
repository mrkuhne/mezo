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

// Én hub — „Hol tartok" (mezo-lhqw7): the /me index composes four units (identity strip → week
// hero → Életvonal → Célok állása) above the Fejlődés / Emberek tiles and the wide Rutin tile.
// Each unit owns its hooks and its honest states, and has its own test file under
// components/hub/; THIS file asserts the composition: the order, what left the hub (the Súly /
// Alvás / Célok / Napló tiles are bottom-bar tabs now, the bio line lives on the Test tab), and
// that everything the old hub linked to is still reachable.
//
// The composition is asserted on the MOCK seeds in both test runs (`VITE_USE_MOCK` is pinned to
// `true` per test): the real-mode MSW fixtures carry a different, sparser account, and the
// units' own tests already cover every honest state at the hook boundary in both modes. The two
// `real mode:` tests at the bottom switch the flag themselves. Only the Rutin tile's two hooks
// are stubbed, as before.
const useHabitDay = vi.hoisted(() => vi.fn())
const useHabitSummary = vi.hoisted(() => vi.fn())

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useHabitDay, useHabitSummary }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
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

afterEach(() => { vi.unstubAllEnvs() })

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
  const hero = document.querySelector('.enh-wkhero')!
  const lifeline = document.querySelector('.enh-elv')!
  const goals = await screen.findByRole('button', { name: 'Célok állása' })
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
  await screen.findByRole('button', { name: 'Fejlődés' })
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
  vi.unstubAllEnvs()
  setToken(null)
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
  vi.unstubAllEnvs()
  setToken(null)
})
