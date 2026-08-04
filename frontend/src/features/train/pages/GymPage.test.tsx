import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { http } from 'msw'
import { GymPage } from '@/features/train/pages/GymPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import type { MesoDay } from '@/data/types'

// GymDayCard taps route straight to the session/review (direct-start flow,
// mezo-bxpg) via useNavigate; mock it so we can assert the exact target
// without a full route tree (idiom already used by GoalsPage.test.tsx).
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Set-budget mirror test (mezo-7rdg) needs an over-budget muscle group, which the
// stock mock meso doesn't produce. Rather than editing the shared mock seed
// (out of scope), wrap the real useTrain and let a single test swap in a
// custom `days` array on top of the otherwise-real activeMeso.
let daysOverride: MesoDay[] | null = null
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useTrain: (...args: Parameters<typeof actual.useTrain>) => {
      const real = actual.useTrain(...args)
      if (!daysOverride || !real.activeMeso) return real
      return { ...real, activeMeso: { ...real.activeMeso, days: daysOverride } }
    },
  }
})

// Asserts Phase-1 mock meso data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  mockNavigate.mockReset()
})
afterEach(() => {
  vi.unstubAllEnvs()
  daysOverride = null
})

const renderView = () => render(<QueryWrapper><MemoryRouter><GymPage /></MemoryRouter></QueryWrapper>)

test('own page-header: pghead-np over + h1 + week badge', () => {
  renderView()
  expect(screen.getByText('Edzés · Gym')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Hypertrophy 04' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mezociklus áttekintő/ })).toBeInTheDocument()
})

test('the Mezociklus chip navigates to the overview (mezo-hi9m)', () => {
  renderView()
  fireEvent.click(screen.getByRole('button', { name: /Mezociklus áttekintő/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/mesocycles/meso-hyp-04/overview')
})

test('meso meta card shows the phase stat', () => {
  renderView()
  expect(screen.getByText('Fázis')).toBeInTheDocument()
})

test('tapping the current training day (Csü Pull) navigates straight to the session (mezo-bxpg)', () => {
  renderView()
  // The day cards are unambiguous via aria-label "{type} · {day}".
  // The active meso's Csü day is `current` AND (mock fixtures carry no `id`,
  // real mode only) — either condition alone routes to plain /train/session.
  const pullDay = screen.getByRole('button', { name: /Pull · Csü/ })
  fireEvent.click(pullDay)
  expect(mockNavigate).toHaveBeenCalledWith('/train/session')
})

test('the Saját header chip opens the custom workout sheet (mezo-ws2x)', () => {
  renderView()
  fireEvent.click(screen.getByRole('button', { name: /Saját$/ }))
  expect(screen.getByText('Mit nyomunk ma?')).toBeInTheDocument()
})

// Live zone grid (mezo-oyhy.7) — group-level mini bars on the meta card + tap → MuscleWeekSheet.
test('meta card shows the live zone mini grid (mezo-oyhy.7)', () => {
  renderView()
  const card = screen.getByRole('button', { name: 'Heti izomterhelés — részletek' })
  // Group-level rows now (budget groups, not per-head pills); mock week has no
  // completed instances → done is 0 for every group.
  expect(within(card).getByText('Hát')).toBeInTheDocument()
  expect(within(card).getAllByText(/^0\/\d+( [⚠↓])?$/).length).toBeGreaterThan(0)
  // Live stats: the Szetek/Gym napok subs flipped to done/plan phrasing.
  expect(within(card).getByText('kész / heti terv')).toBeInTheDocument()
  expect(within(card).getByText('kész / hét')).toBeInTheDocument()
})

test('tapping the meta card opens the MuscleWeekSheet', () => {
  renderView()
  fireEvent.click(screen.getByRole('button', { name: 'Heti izomterhelés — részletek' }))
  expect(screen.getByRole('heading', { name: 'Heti izomterhelés' })).toBeInTheDocument()
})

test('an over-budget group cell shows ⚠ in error color (mezo-oyhy.7)', () => {
  daysOverride = [{
    day: 'Hét', type: 'Push', muscle: 'chest', exerciseCount: 2,
    exercises: [
      { id: 'ob1', name: 'Bench Press', muscle: 'chest', warmupSets: 1, workingSets: 8, repMin: 4, repMax: 6, targetRIR: 1, type: 'compound', anchorWeightKg: 100 },
      { id: 'ob2', name: 'Cable Fly', muscle: 'chest', warmupSets: 1, workingSets: 8, repMin: 12, repMax: 15, targetRIR: 3, type: 'isolation', anchorWeightKg: 15 },
    ],
  }]
  renderView()
  const card = screen.getByRole('button', { name: 'Heti izomterhelés — részletek' })
  const numeric = within(card).getByText(/^0\/16 ⚠$/)
  expect(numeric).toHaveStyle({ color: 'var(--error)' })
})

// Loading skeleton (mezo-f2z) — real mode shows the GymSkeleton (role="status")
// while the meso/today queries are unresolved (workoutPending); mock seeds → no skeleton.
describe('GymPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the meso + today queries are unresolved', async () => {
    // workoutPending = mesoPending || todayPending — both must never resolve.
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => new Promise(() => {})),
      http.get(`${API_BASE}/api/train/workouts/today`, () => new Promise(() => {})),
    )
    renderView()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('GymPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    renderView()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows the "Időpontok" chip in mock mode and reflects a save via local override', async () => {
    renderView()
    const chip = screen.getByRole('button', { name: /Időpontok/ })
    expect(chip).toBeInTheDocument()
    fireEvent.click(chip)
    expect(screen.getByRole('heading', { name: 'Heti gym-időpontok' })).toBeInTheDocument()
    // edit Hét + save
    fireEvent.change(screen.getByLabelText('Hét időpont'), { target: { value: '06:30' } })
    fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    // Sheet closes with an exit animation → wait it out
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Heti gym-időpontok' })).toBeNull())
    // reopen -> the in-session override kept the edit
    fireEvent.click(screen.getByRole('button', { name: /Időpontok/ }))
    expect((screen.getByLabelText('Hét időpont') as HTMLInputElement).value).toBe('06:30')
  })
})
