import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SportPage } from '@/features/train/pages/SportPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Asserts Phase-1 mock sport data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryWrapper><LevelUpProvider><MemoryRouter>{children}</MemoryRouter></LevelUpProvider></QueryWrapper>
)
const renderView = () => render(<SportPage />, { wrapper: Wrapper })

// Mozaik 2.0 re-face (mezo-d20.11): the prototype's #page-sport head is a
// `‹ Edzés` back chip + the `＋ Log` pgact; the venue/team/season hero CARD and
// the RPE explainer are gone (the court lives on each slot row's meta line).
test('page head: ‹ Edzés back chip + the ＋ Log pgact', () => {
  renderView()
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Edzés')
  expect(screen.getByRole('button', { name: '＋ Log' })).toHaveClass('mz-pgact')
  expect(screen.queryByRole('heading', { name: 'Röplabda' })).not.toBeInTheDocument()
})

test('hero is the page name + a logged/scheduled big number, no venue card', () => {
  const { container } = renderView()
  expect(container.querySelector('.mz-hero-nm')).toHaveTextContent('Sport')
  // logged-this-week / scheduled-slots — both derived, never fabricated
  expect(container.querySelector('.mz-bignum')?.textContent).toMatch(/^\d+\/\d+$/)
  expect(screen.queryByText(/RPE = Rate of Perceived Exertion/)).not.toBeInTheDocument()
})

test('stat strip carries the prototype labels', () => {
  renderView()
  expect(screen.getByText('pályán e héten')).toBeInTheDocument()
  expect(screen.getByText('RPE átlag · 1–10')).toBeInTheDocument()
  expect(screen.getByText('váll-terhelés')).toBeInTheDocument()
})

test('default view is the weekly plan', () => {
  renderView()
  expect(screen.getByText(/Heti ritmus · 7\.5 ó/)).toBeInTheDocument()
})

// The prototype renders EVERY day of the week: a day with no slot is a dashed
// „nincs session" row, never omitted (edzes-body `.sday.empty`).
test('every weekday renders — days without a slot show the dashed „nincs session" row', () => {
  const { container } = renderView()
  const days = container.querySelectorAll('.spw-day')
  expect(days.length).toBe(7)
  const empties = container.querySelectorAll('.spw-day.empty')
  expect(empties.length).toBeGreaterThan(0)
  expect(screen.getAllByText('nincs session').length).toBe(empties.length)
})

// Regression (mezo-d20.11): the type tag used to be suppressed for volleyball,
// so a röpi row said nothing about which sport it was. The prototype's `.stag`
// rides every slot.
test('every weekly slot row carries its type tag, RÖPI included', () => {
  const { container } = renderView()
  const rows = container.querySelectorAll('.spw-day.has .spw-slot')
  expect(rows.length).toBeGreaterThan(0)
  rows.forEach((row) => {
    expect(row.querySelector('.stag')).not.toBeNull()
  })
  expect(container.querySelectorAll('.spw-day.has .spw-slot .stag-sport').length).toBeGreaterThan(0)
})

// Motion (mezo-d20.11): the page had NO entrance choreography — an armed
// .mz-play wrapper with staggered .rise children is the prototype's behaviour.
test('the page arms the entrance choreography and staggers its children', () => {
  const { container } = renderView()
  const play = container.querySelector('.mz-play')
  expect(play).not.toBeNull()
  expect(play!.querySelector('.mz-statstrip.rise')).not.toBeNull()
  expect(play!.querySelector('.segtabs.rise')).not.toBeNull()
  const staggered = play!.querySelectorAll('.spw-day.rise')
  expect(staggered.length).toBe(7)
  expect((staggered[1] as HTMLElement).style.getPropertyValue('--d')).toBe('90ms')
})

test('switching to Napló shows the session log header with avg jump count', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
  expect(screen.getByText(/avg \d+ ugrás/)).toBeInTheDocument()
})

test('switching to Napló shows the stag-sport tag on each session row', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
  const tags = screen.getAllByText('RÖPI')
  expect(tags.length).toBeGreaterThan(0)
  expect(tags[0]).toHaveClass('stag', 'stag-sport')
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
  const tag = await screen.findByText('CROSS')
  expect(tag).toHaveClass('stag', 'stag-cross')
  expect(screen.queryByText('RÖPI')).not.toBeInTheDocument()
  // cross sessions show Körök, not Setek.
  expect(screen.getByText('körök')).toBeInTheDocument()
  expect(screen.getByText('5')).toBeInTheDocument()
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

test('switching to Cross-load shows the read tool chip', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Cross-load' }))
  expect(screen.getByText('get_sport_load')).toBeInTheDocument()
})

test('the + Log header chip opens the SportLogSheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Log/ }))
  expect(await screen.findByText(/Sport log ·/)).toBeInTheDocument()
})

test('logging a sport session presents the level-up overlay (mock fixture)', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Log/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
  // The mock logSportSession returns a seeded LevelUpResult → the overlay shows.
  expect(await screen.findByRole('dialog', { name: 'Szintlépés' })).toBeInTheDocument()
})

// ---- real-mode block: schedule from the DB, editor full-replace ----

test('real mode renders the weekly plan from the schedule endpoint', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  // 5 BVSC fixture slots (msw default) -> derived weekly hours 8 and the Mon row time
  expect(await screen.findByText(/Heti ritmus · 8 ó/)).toBeInTheDocument()
  expect(screen.getAllByText(/18:15/).length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'Szerkesztés' })).toBeInTheDocument()
})

test('real mode editor saves the full slot list via PUT', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const put: unknown[] = []
  server.use(
    http.put(`${API_BASE}/api/train/sport-schedule`, async ({ request }) => {
      put.push(await request.json())
      return HttpResponse.json([])
    }),
  )
  renderView()
  await userEvent.click(await screen.findByRole('button', { name: 'Szerkesztés' }))
  expect(await screen.findByRole('heading', { name: 'Heti rend' })).toBeInTheDocument()
  // add a Csü slot (the day is empty in the BVSC week) and save
  await userEvent.click(screen.getByRole('button', { name: 'Csütörtök sport hozzáadása' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(put).toHaveLength(1))
  const slots = put[0] as Array<{ dayOfWeek: number }>
  expect(slots.map((s) => s.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5])
})

test('real mode ghost CTA opens the editor when no schedule exists', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])))
  renderView()
  await userEvent.click(await screen.findByRole('button', { name: /Állítsd be a heti rended/ }))
  expect(await screen.findByRole('heading', { name: 'Heti rend' })).toBeInTheDocument()
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
  expect(await screen.findByText('12:00')).toBeInTheDocument()
  expect(screen.getByText('19:00')).toBeInTheDocument()
  expect(screen.getByText('TRX')).toBeInTheDocument()
  // weeklyHours is a plain JS number rendered raw (no hu-HU locale formatting anywhere
  // in the mapper/view) — 2.5 renders with a dot, not a comma.
  expect(screen.getByText(/Heti ritmus · 2.5 ó/)).toBeInTheDocument()
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
  expect(document.body.querySelector('.mz-bignum')?.textContent).toMatch(/^\d+\/5$/)
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
  expect(screen.queryByText('Intenzitás')).not.toBeInTheDocument() // null intensity -> MiniBar hidden
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
  // ...and the schedule merge lands it on today's day card with the one-off badge
  expect(screen.getByText('EGYSZERI')).toBeInTheDocument()
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
