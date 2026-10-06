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
// hero → Életvonal → Célok állása) above the Fejlődés / Emberek tiles (exactly two; Rutin moved to Nap).
// Each unit owns its hooks and its honest states, and has its own test file under
// components/hub/; THIS file asserts the composition: the order, what left the hub (the Súly /
// Alvás / Célok / Napló tiles are bottom-bar tabs now, the bio line lives on the Test tab), and
// that everything the old hub linked to is still reachable.
//
// Every test runs in BOTH modes with no pin: the mock run reads the seeds, the real run
// (`VITE_USE_MOCK=false`) signs in (`setToken`) and reads the repo's MSW handlers, with the weight
// log re-dated into the Életvonal's 12-week window. Assertions are therefore about structure,
// never about a seed's numbers — those live in the units' own tests.
const REAL = import.meta.env.VITE_USE_MOCK === 'false'
const MON = mondayOf(localDateString())
/** Four measured weeks ending this week — enough for a curve in real mode. */
const WEIGHT_LOG = [3, 2, 1, 0].map((w, i) => ({ id: `w${i}`, date: addDays(MON, -7 * w), value: 80.4 - i * 0.3, note: null }))

beforeEach(() => {
  if (REAL) {
    setToken('t')
    server.use(http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json(WEIGHT_LOG)))
  }
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
  const ART: [string, string][] = [['Fejlődés', '#t-up'], ['Emberek', '#t-people']]
  for (const [label, href] of ART) {
    const tile = screen.getByRole('button', { name: label })
    expect(tile).toHaveClass('glass')
    expect(tile.querySelector('.mz-spotwrap use')?.getAttribute('href')).toBe(href)
  }
  // never glass inside glass, never a control inside a control
  expect(document.querySelectorAll('.glass .glass')).toHaveLength(0)
  expect(document.querySelectorAll('button button')).toHaveLength(0)
})

test('the Súly, Alvás, Célok and Napló tiles left the hub — they are tabs now, and Rutin moved to Nap', async () => {
  renderHub()
  await screen.findByRole('button', { name: 'Fejlődés' })
  for (const label of ['Súly', 'Alvás', 'Célok', 'Napló', 'Growth']) {
    expect(screen.queryByRole('button', { name: label })).toBeNull()
  }
  expect(document.querySelectorAll('.mz-tile')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: 'Rutin' })).toBeNull()
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
