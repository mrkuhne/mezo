import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { TrainWeekPage } from '@/features/train/pages/TrainWeekPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { DAY_ORDER } from '@/data/train/train'
import { localDateString } from '@/shared/lib/dates'
import type { MesoDay } from '@/data/types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Set-budget mirror test (folded in from GymPage.test.tsx, mezo-d20.3.2) needs an
// over-budget muscle group the stock mock meso doesn't produce — wrap the real
// useTrain and swap in a custom `days` array on top of the otherwise-real activeMeso.
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

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  mockNavigate.mockReset()
})
afterEach(() => {
  vi.unstubAllEnvs()
  daysOverride = null
})

const renderPage = () => render(<QueryWrapper><MemoryRouter><LevelUpProvider><TrainWeekPage /></LevelUpProvider></MemoryRouter></QueryWrapper>)

test('renders the Heti hero, the load tiles and one card per weekday', () => {
  const { container } = renderPage()
  expect(screen.getByText('Heti edzések')).toBeInTheDocument()
  expect(container.querySelectorAll('.loadtile')).toHaveLength(3)
  expect(container.querySelectorAll('.dayrow')).toHaveLength(7)
})

// ---- folded in from GymPage.test.tsx (mezo-d20.3.2): the muscle-zone meta
// card, the Mezociklus áttekintő chip and the Időpontok schedule sheet ----

test('the Mezociklus áttekintő chip navigates to the overview (mezo-hi9m)', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Mezociklus áttekintő/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/mesocycles/meso-hyp-04/overview')
})

test('the izom-zóna panel shows the live zone mini grid (mezo-oyhy.7)', () => {
  renderPage()
  const panel = screen.getByRole('button', { name: 'Heti izomterhelés — részletek' })
  // Group-level rows (budget groups, not per-head pills); mock week has no
  // completed instances → done is 0 for every group.
  expect(within(panel).getByText('Hát')).toBeInTheDocument()
  expect(within(panel).getAllByText(/^0\/\d+( [⚠↓])?$/).length).toBeGreaterThan(0)
})

test('tapping the izom-zóna panel opens the MuscleWeekSheet', () => {
  renderPage()
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
  renderPage()
  const panel = screen.getByRole('button', { name: 'Heti izomterhelés — részletek' })
  const numeric = within(panel).getByText(/^0\/16 ⚠$/)
  expect(numeric).toHaveStyle({ color: 'var(--error)' })
})

test('the Időpontok chip opens the schedule sheet and reflects a save via local override', async () => {
  renderPage()
  const chip = screen.getByRole('button', { name: /Időpontok/ })
  fireEvent.click(chip)
  expect(screen.getByRole('heading', { name: 'Heti gym-időpontok' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Hét időpont'), { target: { value: '06:30' } })
  fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Heti gym-időpontok' })).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: /Időpontok/ }))
  expect((screen.getByLabelText('Hét időpont') as HTMLInputElement).value).toBe('06:30')
})

test('tapping a non-gym session drills into Mai with that day selected', () => {
  const { container } = renderPage()
  // the mock week has volleyball on Monday (index 0) — its session block navigates to Mai
  const monday = container.querySelectorAll('.dayrow')[0]
  const sportBlock = monday.querySelectorAll('.s')
  fireEvent.click(sportBlock[sportBlock.length - 1])
  expect(mockNavigate).toHaveBeenCalledWith('/train?day=0')
})

test('keeps the provenance note and the Saját edzés footer', () => {
  renderPage()
  expect(screen.getByText(/A gym a mesociklus szerint/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Saját edzés/ })).toBeInTheDocument()
})

// ---- moved from TrainTodayPage.test.tsx (mezo-9bbc): the weekly list + its taps now
// live here, not on Mai (which only renders the selected day) ----

test('renders a Pihenőnap rest row for the empty Vasárnap slot', () => {
  renderPage()
  expect(screen.getByText('Pihenőnap')).toBeInTheDocument()
})

test('a non-today weekly gym row navigates straight to the session (mezo-j3x0 / mezo-bxpg)', () => {
  renderPage()
  // Mock today = Csü (fixture flag); the Hét row shows the Push Day slot → non-today gym row.
  fireEvent.click(screen.getByRole('button', { name: /Push Day/ }))
  // Mock MesoDay fixtures carry no `id` (real mode only), so the `!day.id` branch wins
  // regardless of the non-today `?day=` rule — plain /train/session, not /train/session?day=.
  expect(mockNavigate).toHaveBeenCalledWith('/train/session')
})

test('the Saját edzés footer opens the sheet (mezo-ws2x)', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: /Saját edzés/ }))
  expect(screen.getByText('Mit nyomunk ma?')).toBeInTheDocument()
  expect(screen.getByText('Pihenőnapi felső')).toBeInTheDocument()
})

// A template day completed THIS week but pulled forward to another date (not its own
// weekday's date) must still route the weekly-row tap to its review, not restart it
// into a fresh session (409 TRAIN_DAY_DONE_THIS_WEEK) — the date-only workoutIdByDate
// match misses it, so the row falls back to onOpenGymDay, which must resolve via
// gymDayTarget's templateSessionId check (final-review fix, mezo-bxpg — Finding 1).
test('real mode: a weekly gym row completed this week on ANOTHER date routes to its review, not a restart', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayLabel = DAY_ORDER[(new Date().getDay() + 6) % 7]
  const otherDayLabel = DAY_ORDER[(DAY_ORDER.indexOf(todayLabel) + 1) % 7]
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () =>
      HttpResponse.json([{
        id: 'm-1', title: 'T2 meso', shortTitle: 'T2', status: 'active',
        startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
        split: 'Pull / Push · 2×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MAV'],
        days: [{
          id: 'd-1', day: otherDayLabel, type: 'Pull Day', muscle: 'back', exerciseCount: 1,
          exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
        }],
      }]),
    ),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
    // today itself is empty — unrelated to this row's own weekday
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    // completed this week, same template (d-1), but on TODAY's date — not the row's
    // own weekday date — so the date-keyed workoutIdByDate lookup can't match it.
    http.get(`${API_BASE}/api/train/workouts`, () =>
      HttpResponse.json([
        { id: 'w-pulled', templateSessionId: 'd-1', date: localDateString(), status: 'completed', origin: 'meso' },
      ]),
    ),
  )
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: /Pull Day/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/review/w-pulled')
})

// Motion (mezo-d20.11): the page shipped an ARMED EntranceGroup with nothing
// marked `.rise` — the wrapper was animating an empty stage. Both halves must
// exist, and the day list must carry the prototype's 40ms-step stagger.
test('the week body staggers inside the armed entrance group', async () => {
  const { container } = renderPage()
  await screen.findByText('szett terv')
  const play = container.querySelector('.mz-play')
  expect(play).not.toBeNull()
  const strip = play!.querySelector('.mz-statstrip.rise') as HTMLElement | null
  expect(strip).not.toBeNull()
  expect(strip!.style.getPropertyValue('--d')).toBe('40ms')
  const dayRows = [...play!.querySelectorAll('.rise')].filter(
    (el) => (el as HTMLElement).style.getPropertyValue('--d') === '140ms',
  )
  expect(dayRows.length).toBe(1)
})
