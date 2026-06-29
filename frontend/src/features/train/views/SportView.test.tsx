import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { SportView } from './SportView'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Asserts Phase-1 mock sport data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryWrapper><LevelUpProvider>{children}</LevelUpProvider></QueryWrapper>
)
const renderView = () => render(<SportView />, { wrapper: Wrapper })

test('own page-header: brand eyebrow + PageTitle', () => {
  renderView()
  expect(screen.getByText('Train · Sport')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Röplabda' })).toBeInTheDocument()
})

test('hero shows the venue Display and the RPE explainer', () => {
  renderView()
  expect(screen.getByText('BVSC csarnok')).toBeInTheDocument()
  expect(screen.getByText(/RPE = Rate of Perceived Exertion/)).toBeInTheDocument()
})

test('default view is the weekly plan', () => {
  renderView()
  expect(screen.getByText(/Heti ritmus · 7\.5h court/)).toBeInTheDocument()
})

test('switching to Napló shows the session log header with avg jump count', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
  expect(screen.getByText(/avg \d+ ugrás/)).toBeInTheDocument()
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
  expect(await screen.findByText(/Heti ritmus · 8h court/)).toBeInTheDocument()
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
  // toggle Csü on (it is off in the BVSC week) and save
  await userEvent.click(screen.getByRole('button', { name: 'Csü session' }))
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
  // schedule-derived venue replaces the hardcoded string; /5 heti = 5 fixture slots
  expect(await screen.findByText('/5 heti')).toBeInTheDocument()
  expect(screen.getByText('BVSC csarnok')).toBeInTheDocument()
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

// Loading skeleton (mezo-f2z) — real mode shows the SportSkeleton (role="status")
// while the sport-sessions query is unresolved (sportPending); mock seeds → no skeleton.
describe('SportView (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the sport-sessions query is unresolved', async () => {
    server.use(http.get(`${API_BASE}/api/train/sport-sessions`, () => new Promise(() => {})))
    renderView()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('SportView (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    renderView()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
