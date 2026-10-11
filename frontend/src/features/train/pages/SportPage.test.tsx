import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SportPage } from '@/features/train/pages/SportPage'
import { outOf } from '@/shared/lib/huText'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { sportLevelUpMock } from '@/data/progression/progressionMock'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Asserts Phase-1 mock sport data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryWrapper><LevelUpProvider><MemoryRouter>{children}</MemoryRouter></LevelUpProvider></QueryWrapper>
)
const renderView = () => render(<SportPage />, { wrapper: Wrapper })

// Folyadék (mezo-n4wf5.3, prototype `sport()`): the title bar owns the back control inside the app
// frame; rendered alone the page keeps its own `‹ Edzés` pill. The hero's one button is „＋ Log".
test('page head: ‹ Edzés back pill, and the hero carries the ＋ Log button', () => {
  const { container } = renderView()
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent(/‹\s*Edzés/)
  expect(screen.getByRole('button', { name: '＋ Log' }).closest('.fo-hero-acts')).not.toBeNull()
  expect(screen.queryByRole('heading', { name: 'Röplabda' })).not.toBeInTheDocument()
  // the old skin is gone from the page
  expect(container.querySelector('.glass, [class*="uvs-"], [class*="mz-"], .stag, .segtabs')).toBeNull()
})

test('hero says the verdict — logged of scheduled — and draws the week as seven tubes', () => {
  const { container } = renderView()
  expect(container.querySelector('.fo-hero-lbl')).toHaveTextContent('Sport · ezen a héten')
  // logged-this-week out of the scheduled slots — both derived, never fabricated
  expect(container.querySelector('.fo-hero-verdict')?.textContent).toMatch(/^\d+ session megvolt a \d+-b[óő]l ezen a héten\.$/)
  const tubes = container.querySelectorAll('.fo-hero .fo-hero-g .fo-vial')
  expect(tubes).toHaveLength(7)
  // a free day is a hatched tube, a scheduled day carries its minutes and its start time
  expect(container.querySelectorAll('.fo-hero .fo-hero-g .fo-vial.hatch').length).toBeGreaterThan(0)
  expect(container.querySelector('.fo-hero .fo-hero-g .fo-vial:not(.hatch) b')?.textContent).toMatch(/^\d+′$/)
  expect(screen.queryByText(/RPE = Rate of Perceived Exertion/)).not.toBeInTheDocument()
})

test('the „N-ból / N-ből" suffix follows the spoken number', () => {
  expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20].map(outOf)).toEqual(
    ['1-ből', '2-ből', '3-ból', '4-ből', '5-ből', '6-ból', '7-ből', '8-ból', '9-ből', '10-ből', '20-ból'])
})

test('stat strip carries the prototype labels', () => {
  renderView()
  expect(screen.getByText('pályán e héten')).toBeInTheDocument()
  expect(screen.getByText('RPE átlag · 1–10')).toBeInTheDocument()
  expect(screen.getByText('váll-terhelés')).toBeInTheDocument()
})

test('default view is the weekly plan', () => {
  renderView()
  expect(screen.getByRole('heading', { name: /Heti ritmus · 7,5 ó/ })).toBeInTheDocument()
})

// The prototype renders EVERY day of the week: a day with no slot is a dimmed
// „nincs session" row, never omitted (`rw({cls:'muted', …})`).
test('every weekday renders — days without a slot show the dimmed „nincs session" row', () => {
  const { container } = renderView()
  const empties = container.querySelectorAll('.es-week .es-day.dim')
  expect(empties.length).toBeGreaterThan(0)
  expect(screen.getAllByText('nincs session').length).toBe(empties.length)
  // every weekday has at least one row, each led by its day badge
  const badges = [...container.querySelectorAll('.es-week .es-day .ex-day')].map((b) => b.textContent)
  expect(new Set(badges)).toEqual(new Set(['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']))
})

// Regression (mezo-d20.11): the type tag used to be suppressed for volleyball,
// so a röpi row said nothing about which sport it was. The sport pill rides every slot.
test('every weekly slot row carries its sport pill, Röpi included', () => {
  const { container } = renderView()
  const rows = container.querySelectorAll('.es-week .es-day.has')
  expect(rows.length).toBeGreaterThan(0)
  rows.forEach((row) => {
    expect(row.querySelector('.fo-st')).not.toBeNull()
  })
  expect(within(container.querySelector('.es-week') as HTMLElement).getAllByText('Röpi').length).toBeGreaterThan(0)
})

// Structure (prototype `sport()`): hero → the segmented control → numbered sections in white cards.
test('the page is hero → segmented control → numbered sections', () => {
  const { container } = renderView()
  const page = container.querySelector('.fo-page.es-sport')!
  const kids = [...page.children].map((c) => c.className)
  expect(kids.findIndex((c) => c.includes('fo-hero'))).toBeLessThan(kids.findIndex((c) => c.includes('fo-seg')))
  expect(kids.findIndex((c) => c.includes('fo-seg'))).toBeLessThan(kids.findIndex((c) => c.includes('fo-sec')))
  expect(page.querySelector('.fo-seg')).toHaveAttribute('data-kalauz-anchor', 'sport-tabs')
  expect([...page.querySelectorAll('.fo-sec')].map((h) => h.textContent)).toEqual(
    [expect.stringMatching(/^1Heti ritmus/), '2Egyszeri események'])
  // the independence note, in the prototype's words
  expect(screen.getByText('Heti ritmus · független')).toBeInTheDocument()
})

test('switching to Napló shows the session log header with avg jump count', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
  expect(screen.getByRole('heading', { name: /Utolsó \d+ session · átlag \d+ ugrás/ })).toBeInTheDocument()
})

test('switching to Napló shows each session as a row with its sport, levels and note', async () => {
  const { container } = renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
  const rows = container.querySelectorAll('.es-logs .es-log')
  expect(rows.length).toBeGreaterThan(0)
  expect(rows[0].querySelector('.fo-row small')?.textContent).toMatch(/^Röpi · idő \d+p · setek \d+$/)
  expect(rows[0].querySelector('.fo-row use')?.getAttribute('href')).toBe('#t-volley')
  expect(rows[0].querySelector('.fo-row .v')?.textContent).toMatch(/RPE$/)
  // Intenzitás + Váll terhelés as two labelled levels
  expect(rows[0].querySelectorAll('.es-l2 .fo-level')).toHaveLength(2)
})

// Load-bearing fix (mezo-d20.3.4): the session card previously hardcoded a
// stag-sport RÖPI tag on every row, mislabeling cross/TRX sessions.
test('real mode Napló renders a kind-correct tag for a cross session', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/sport-sessions`, () =>
      HttpResponse.json([
        { id: 'd1f3a0e2-0000-4000-8000-000000000077', sport: 'cross', date: '2026-06-01', time: '07:30', duration: 30, rounds: 5, rpe: 6 },
      ]),
    ),
  )
  renderView()
  await userEvent.click(await screen.findByRole('button', { name: 'Napló' }))
  // cross sessions say Cross and show körök, not setek — with the cross glyph.
  const line = await screen.findByText('Cross · idő 30p · körök 5')
  expect(line.closest('.fo-row')?.querySelector('use')?.getAttribute('href')).toBe('#t-crossfit')
  expect(screen.queryByText(/Röpi/)).not.toBeInTheDocument()
})

// Inline "Logold ›" on today's slot (README checklist) preselects that
// slot's sport when opening the log sheet.
test('real mode: today\'s slot shows an inline Logold chip that preselects the sport', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIdx = (new Date().getDay() + 6) % 7
  server.use(
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
      { id: 'sl-today', dayOfWeek: todayIdx, time: '18:00', durationMin: 60, kind: 'training', sport: 'trx', location: 'Life1 Corvin' },
    ])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
  )
  renderView()
  await userEvent.click(await screen.findByRole('button', { name: 'Logold ›' }))
  expect(await screen.findByText('Sport log · TRX')).toBeInTheDocument()
})

// mezo-i6q2b: once today's slot is logged, its inline CTA gives way to a done chip — the
// match is by DAY and SPORT (the Mai rule), so a different sport logged today leaves it open.
describe('real mode: today\'s slot done-state', () => {
  const todayIso = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const withTodayTrxSlot = (loggedSport: string) => {
    const todayIdx = (new Date().getDay() + 6) % 7
    server.use(
      http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
        { id: 'sl-today', dayOfWeek: todayIdx, time: '18:00', durationMin: 60, kind: 'training', sport: 'trx', location: 'Life1 Corvin' },
      ])),
      http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([
        { id: 'd1f3a0e2-0000-4000-8000-000000000099', sport: loggedSport, date: todayIso(), time: '18:05', duration: 60, rpe: 7 },
      ])),
    )
  }

  it('a slot logged today shows Kész instead of Logold', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    withTodayTrxSlot('trx')
    renderView()
    expect(await screen.findByText('Kész')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Logold ›' })).not.toBeInTheDocument()
  })

  it('a different sport logged today leaves the slot open', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    withTodayTrxSlot('volleyball')
    renderView()
    expect(await screen.findByRole('button', { name: 'Logold ›' })).toBeInTheDocument()
    expect(screen.queryByText('Kész')).not.toBeInTheDocument()
  })
})

// Folyadék: the tool chips became plain-language tags, the intro is Mezo's own sentence.
test('switching to Cross-load shows Mezo\'s sentence, the plain tags and one row per affected area', async () => {
  const { container } = renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Cross-load' }))
  expect(screen.getByRole('heading', { name: /Keresztrendszer hatások/ })).toBeInTheDocument()
  expect(screen.getByText(/A röplabda terhelését minden területen beszámítjuk/)).toBeInTheDocument()
  expect(screen.getByText('28 nap sportterhelése')).toBeInTheDocument()
  expect(screen.queryByText('get_sport_load')).not.toBeInTheDocument()
  const rows = container.querySelectorAll('.es-cross .es-xrow')
  expect(rows.length).toBeGreaterThan(0)
  rows.forEach((row) => expect(row.querySelector('.fo-st')).not.toBeNull())
  // a warning row's pill wears the „bad" tone; the system reads in plain Hungarian
  expect(container.querySelector('.es-cross .es-xrow.is-warn .fo-st.bad')).not.toBeNull()
  expect(screen.queryByText('Patterns')).not.toBeInTheDocument()
  expect(screen.getByText(/A cross-load sosem büntet/)).toBeInTheDocument()
})

// T8 Task 4 (mezo-88iwa.9): the header's log CTA no longer opens the sheet in place — it
// leaves for the full-screen sport flow, which asks WHICH sport before anything else.
test('the + Log header chip routes to the full-screen sport flow', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Log/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/sport/log')
  expect(screen.queryByText(/Sport log ·/)).not.toBeInTheDocument()
})

// The scheduled slot's inline "Logold ›" still logs in place (it carries the slot's own
// preselected sport), so the level-up overlay contract is asserted through THAT door —
// real mode, because that door only appears when a slot sits on today.
test('logging a sport session presents the level-up overlay', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIdx = (new Date().getDay() + 6) % 7
  server.use(
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
      { id: 'sl-today', dayOfWeek: todayIdx, time: '18:00', durationMin: 60, kind: 'training', sport: 'trx', location: 'Life1 Corvin' },
    ])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.post(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json(
      { id: 'ss-1', sport: 'trx', date: '2026-09-16', time: '18:00', duration: 60, rpe: 7, levelUp: sportLevelUpMock },
      { status: 201 },
    )),
  )
  renderView()
  await userEvent.click(await screen.findByRole('button', { name: 'Logold ›' }))
  await userEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
  expect(await screen.findByRole('dialog', { name: 'Szintlépés' })).toBeInTheDocument()
})

// ---- real-mode block: schedule from the DB, editor full-replace ----

test('real mode renders the weekly plan from the schedule endpoint', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  // 5 BVSC fixture slots (msw default) -> derived weekly hours 8 and the Mon row time
  expect(await screen.findByText(/Heti ritmus · 8 ó/)).toBeInTheDocument()
  expect(screen.getAllByText(/18:15/).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: 'Szerkesztés' })).not.toBeInTheDocument()
})

test('real mode setup CTA leads to the canonical settings editor', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])))
  renderView()
  await userEvent.click(await screen.findByRole('button', { name: /Állítsd be a heti rended/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/settings/train/sport')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('real mode: a day with TRX + volleyball slots renders both rows with sport tags', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
      { id: 'sl-1', dayOfWeek: 1, time: '12:00', durationMin: 60, kind: 'training', sport: 'trx', location: 'Life1 Corvin' },
      { id: 'sl-2', dayOfWeek: 1, time: '19:00', durationMin: 90, kind: 'training', sport: 'volleyball', location: 'BVSC csarnok' },
    ])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
  )
  renderView()
  expect(await screen.findByText(/12:00 · 60p/)).toBeInTheDocument()
  expect(screen.getByText(/19:00 · 90p/)).toBeInTheDocument()
  expect(screen.getByText('TRX')).toBeInTheDocument()
  // Folyadék: the hours read with the Hungarian decimal comma (prototype `d1`).
  expect(screen.getByRole('heading', { name: /Heti ritmus · 2,5 ó/ })).toBeInTheDocument()
  // both slots share Tuesday: one tube, the two sessions' minutes together, the first one's time
  const tube = document.body.querySelectorAll('.fo-hero .fo-hero-g .fo-vial')[1]
  expect(tube.querySelector('b')).toHaveTextContent('150′')
  expect(tube.querySelector('em')).toHaveTextContent('12:00')
})

test('real mode hero shows week stats once a session lands in the current week', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  server.use(
    http.get(`${API_BASE}/api/train/sport-sessions`, () =>
      HttpResponse.json([
        { id: 'd1f3a0e2-0000-4000-8000-000000000088', sport: 'volleyball', date: iso, time: '18:00', duration: 90, setsPlayed: 5, rpe: 7, shoulderStrain: 6 },
      ]),
    ),
  )
  renderView()
  // The hero big number is logged/scheduled — 5 fixture slots is the denominator,
  // and the court now reads off the slot row's meta line (no venue Display).
  await screen.findByText(/Heti ritmus · \d/)
  expect(document.body.querySelector('.fo-hero-verdict')?.textContent).toMatch(/^\d+ session megvolt a 5-ből ezen a héten\.$/)
  expect(screen.getAllByText(/BVSC csarnok/).length).toBeGreaterThan(0)
})

test('real mode Napló hides the jump average when sessions carry no jumpCount', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/sport-sessions`, () =>
      HttpResponse.json([
        { id: 'd1f3a0e2-0000-4000-8000-000000000099', sport: 'volleyball', date: '2026-06-01', time: '18:00', duration: 90, setsPlayed: 5, rpe: 7, shoulderStrain: 6 },
      ]),
    ),
  )
  renderView()
  await userEvent.click(await screen.findByRole('button', { name: 'Napló' }))
  expect(await screen.findByText(/Utolsó 1 session/)).toBeInTheDocument()
  expect(screen.queryByText(/ugrás/)).not.toBeInTheDocument()
  expect(screen.queryByText('Intenzitás')).not.toBeInTheDocument() // null intensity -> the level is hidden
})

// ---- One-off events (mezo-e1sp) ----

test('mock: the dashed chip opens the SportEventSheet and a save lands in the upcoming list', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: '＋ Egyszeri esemény' }))
  expect(await screen.findByRole('heading', { name: 'Új esemény' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  // default date = today → the cache-emulated write shows up in the upcoming list
  expect(await screen.findByText('Egyszeri események')).toBeInTheDocument()
  expect(screen.getByText(/90p · meccs/)).toBeInTheDocument()
  // ...and the schedule merge lands it on today's row with the one-off pill
  expect(screen.getByText('Egyszeri')).toBeInTheDocument()
})

test('real mode renders upcoming one-off events and deletes via the ✕', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const deleted: string[] = []
  server.use(
    http.get(`${API_BASE}/api/train/sport-events`, () =>
      HttpResponse.json([
        { id: 'e3f3a0e2-0000-4000-8000-0000000000e1', date: iso, time: '19:30', durationMin: 120, kind: 'match', sport: 'volleyball', location: 'Kőbánya Sport' },
      ]),
    ),
    http.delete(`${API_BASE}/api/train/sport-events/:id`, ({ params }) => {
      deleted.push(String(params.id))
      return new HttpResponse(null, { status: 204 })
    }),
  )
  renderView()
  expect(await screen.findByText('Egyszeri események')).toBeInTheDocument()
  expect(screen.getByText(/120p · meccs · Kőbánya Sport/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /esemény törlése/ }))
  await waitFor(() => expect(deleted).toEqual(['e3f3a0e2-0000-4000-8000-0000000000e1']))
})

// Loading skeleton (mezo-f2z) — real mode shows the SportSkeleton (role="status")
// while the sport-sessions query is unresolved (sportPending); mock seeds → no skeleton.
describe('SportPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the sport-sessions query is unresolved', async () => {
    server.use(http.get(`${API_BASE}/api/train/sport-sessions`, () => new Promise(() => {})))
    renderView()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('SportPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    renderView()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
