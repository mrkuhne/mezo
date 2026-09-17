import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { TrainWeekMapPage } from '@/features/train/pages/TrainWeekMapPage'
import { QueryWrapper } from '@/test/queryWrapper'
import type { MesoDay } from '@/data/types'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mirrors TrainWeekPage.test.tsx's override rig — the mock-empty-plan test needs a week
// with NO plan at all, and the all-touched test needs a completed log the stock mock meso
// never produces on its own.
let daysOverride: MesoDay[] | null = null
let weekLogOverride: WorkoutDetailResponse[] | null = null
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useTrain: (...args: Parameters<typeof actual.useTrain>) => {
      const real = actual.useTrain(...args)
      if (!daysOverride) return real
      return { ...real, activeMeso: real.activeMeso ? { ...real.activeMeso, days: daysOverride } : real.activeMeso }
    },
    useWeekMuscleLog: (...args: Parameters<typeof actual.useWeekMuscleLog>) => {
      const real = actual.useWeekMuscleLog(...args)
      return weekLogOverride ? { ...real, details: weekLogOverride } : real
    },
  }
})

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-05-21T09:00:00'))
  vi.stubEnv('VITE_USE_MOCK', 'true')
  mockNavigate.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  daysOverride = null
  weekLogOverride = null
})

const renderPage = () => render(<QueryWrapper><MemoryRouter><TrainWeekMapPage /></MemoryRouter></QueryWrapper>)

test('renders the Izomtérkép hero with the back pill docked inside it', async () => {
  const { container } = renderPage()
  await screen.findByText('Hol tart a tested?')
  const hero = container.querySelector('.ld-hero.is-slim') as HTMLElement
  expect(hero).not.toBeNull()
  const back = within(hero).getByRole('button', { name: /Terhelés/ })
  expect(back).toHaveClass('ld-back')
  fireEvent.click(back)
  expect(mockNavigate).toHaveBeenCalledWith('/train/week')
})

test('the mode chips re-render the SAME body map with different heat, never re-derive from scratch', async () => {
  const { container } = renderPage()
  await waitFor(() => expect(container.querySelectorAll('.ld-map-big .body-map-shape').length).toBeGreaterThan(0))
  const doneOpacities = () => [...container.querySelectorAll('.ld-map-big .body-map-shape')]
    .map((g) => Number((g as SVGElement).getAttribute('opacity')))
  const before = doneOpacities()

  fireEvent.click(screen.getByRole('button', { name: 'A heti terv' }))
  await waitFor(() => expect(doneOpacities()).not.toEqual(before))
  // switching mode never touches the doorway itself — still one BodyMap, still both views.
  expect(container.querySelectorAll('.ld-map-big').length).toBe(1)
})

test('the legend speaks the four fatigue words in "Eddig megvolt" mode', () => {
  const { container } = renderPage()
  const legend = container.querySelector('.ld-legend') as HTMLElement
  expect(within(legend).getByText('még vár')).toBeInTheDocument()
  expect(within(legend).getByText('elkezdted')).toBeInTheDocument()
  expect(within(legend).getByText('jó úton')).toBeInTheDocument()
  expect(within(legend).getByText('megvan')).toBeInTheDocument()
})

test('"A heti terv" mode swaps in its own one-line legend, not the fatigue words', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'A heti terv' }))
  expect(screen.getByText(/minél többet kér a hét/)).toBeInTheDocument()
  expect(screen.queryByText('még vár')).toBeNull()
})

test('mock-empty honesty: the untouched list names the planned-but-untouched groups', () => {
  renderPage()
  expect(screen.getByText('Még munkára vár')).toBeInTheDocument()
  expect(screen.getAllByText(/szett vár a héten/).length).toBeGreaterThan(0)
})

// A week with NO plan at all must not fabricate either the "minden sorra került" claim
// (nothing has been "reached" when nothing was ever asked) or an empty untouched list.
test('mock-empty honesty: a week with no plan at all shows neither the wait list nor a false "all reached" claim', () => {
  daysOverride = []
  renderPage()
  expect(screen.queryByText('Még munkára vár')).toBeNull()
  expect(screen.queryByText('Minden izomcsoportod sorra került ezen a héten.')).toBeNull()
})

test('a week with every planned group already touched says so, honestly', () => {
  daysOverride = [{
    day: 'Hét', type: 'Push', muscle: 'chest', exerciseCount: 1,
    exercises: [{ id: 'e-1', name: 'Bench', muscle: 'chest', warmupSets: 0, workingSets: 2, repMin: 8, repMax: 10, targetRIR: 2, type: 'compound' }],
  }]
  // untouchedMuscles only cares whether ANY work landed (doneSets===0) — one logged set on
  // the plan's one group is enough to clear it off the waiting list honestly.
  weekLogOverride = [{
    id: 'w-1', templateSessionId: 'ts-1', date: '2026-05-20', status: 'completed',
    title: 'Push', dayLabel: 'Hét',
    exercises: [{
      exerciseId: 'e-1', name: 'Bench', muscle: 'chest', type: 'compound',
      warmupSets: 0, workingSets: 1, repMin: 8, repMax: 10, targetRIR: 2, skipped: false,
      sets: [{ id: 's1', exerciseId: 'e-1', setIndex: 0, reps: 8, rir: 2, skipped: false, kind: 'working' }],
    }],
  }] as unknown as WorkoutDetailResponse[]
  renderPage()
  expect(screen.getByText('Minden izomcsoportod sorra került ezen a héten.')).toBeInTheDocument()
  expect(screen.queryByText('Még munkára vár')).toBeNull()
})

test('the sport-reach note names the touched muscles and labels itself an estimate', () => {
  renderPage()
  expect(screen.getByText(/A sport ezeket is dolgoztatta/)).toBeInTheDocument()
  expect(screen.getByText(/Becslés, nem mérés/)).toBeInTheDocument()
})

// Parity P2 Task 1 (matrix §13): the prototype's own quiet doorway at the foot of
// `mapScreen()` — copy verbatim, routing to the „Minden izomjel" screen.
test('the quiet doorway to „Minden izomjel" carries the prototype copy and routes there', () => {
  const { container } = renderPage()
  const row = container.querySelector('.pl-row.is-quiet') as HTMLElement
  expect(row).not.toBeNull()
  expect(within(row).getByText('Minden izomjel')).toBeInTheDocument()
  expect(within(row).getByText('A 21 izom, saját jellel, régiónként')).toBeInTheDocument()
  fireEvent.click(row)
  expect(mockNavigate).toHaveBeenCalledWith('/train/week/jelek')
})

// ── the ⓘ explain layer (mezo-b516k, Task 2) ──────────────────────────────────────────
// The button beside the heading, the prototype's copy word for word. The aria-label is
// the prototype's own `"<title> — mit jelent?"`.

test('ⓘ in the hero sentence explains what the map is drawn from, word for word', async () => {
  renderPage()
  const btn = await screen.findByRole('button', { name: 'Miből rajzoljuk? — mit jelent?' })
  expect(btn.closest('.ld-hero-say')?.textContent).toContain(
    'Amit már megmozgattál, erősebben világít — ami még vár, az csak körvonal.',
  )
  fireEvent.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'Miből rajzoljuk?' })).getByText(
      'A futó terved e heti szettjeiből: minden izom annyira fénylik, amennyi a heti munkájából már megvan. A terv nézet azt festi fel, mit kér a hét — ott az erősebb szín többet kérő izmot jelent.',
    ),
  ).toBeInTheDocument()
})
