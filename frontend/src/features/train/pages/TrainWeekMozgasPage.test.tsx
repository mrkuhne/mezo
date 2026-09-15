import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { TrainWeekMozgasPage } from '@/features/train/pages/TrainWeekMozgasPage'
import { QueryWrapper } from '@/test/queryWrapper'
import type { SportLoadResult } from '@/features/train/logic/sportMuscleLoad'

// The mock/week fixtures always carry at least one sport/run event — the honest-absence
// test needs to force sportLoadForWeek's result to empty rather than fighting the fixtures.
let sportLoadOverride: SportLoadResult | null = null
vi.mock('@/features/train/logic/sportMuscleLoad', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/train/logic/sportMuscleLoad')>()
  return {
    ...actual,
    sportLoadForWeek: (...args: Parameters<typeof actual.sportLoadForWeek>) =>
      sportLoadOverride ?? actual.sportLoadForWeek(...args),
  }
})

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// The gym/sport-honesty test needs a weight-less goal — mock mode's own goal fixture
// always carries a weight on file. The skeleton test needs the week's own detail fetch
// still pending — mock mode resolves synchronously otherwise.
let weightOverride: number | null | undefined
let weekLogOverride: { details: []; pending: boolean } | null = null
// Fix round 1 (mezo-88iwa.13 review): goal/timing-profile pending must NOT gate the whole
// page — only per-card honesty (known:false fallbacks) should react to it, mirroring
// TrainTodayPage's workoutPending||runningPending-only gate.
let goalPendingOverride = false
let timingPendingOverride = false
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useGoal: (...args: Parameters<typeof actual.useGoal>) => {
      const real = actual.useGoal(...args)
      const withPending = goalPendingOverride ? { ...real, pending: true } : real
      if (weightOverride === undefined) return withPending
      return { ...withPending, goal: withPending.goal ? { ...withPending.goal, currentWeight: weightOverride } : withPending.goal, goalResponse: null }
    },
    useTimingProfile: (...args: Parameters<typeof actual.useTimingProfile>) => {
      const real = actual.useTimingProfile(...args)
      return timingPendingOverride ? { ...real, isPending: true } : real
    },
    useWeekMuscleLog: (...args: Parameters<typeof actual.useWeekMuscleLog>) => {
      const real = actual.useWeekMuscleLog(...args)
      return weekLogOverride ? { ...real, details: weekLogOverride.details, pending: weekLogOverride.pending } : real
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
  weightOverride = undefined
  weekLogOverride = null
  goalPendingOverride = false
  timingPendingOverride = false
  sportLoadOverride = null
})

const renderPage = () => render(<QueryWrapper><MemoryRouter><TrainWeekMozgasPage /></MemoryRouter></QueryWrapper>)

test('renders the Minden mozgásod hero with the drawn total minutes and the back pill', async () => {
  const { container } = renderPage()
  await waitFor(() => expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull())
  const hero = container.querySelector('.ld-hero.is-slim') as HTMLElement
  expect(hero).not.toBeNull()
  const minutes = Number(within(hero).getByText(/^\d+$/).textContent)
  expect(Number.isInteger(minutes)).toBe(true)
  expect(within(hero).getByText('perc')).toBeInTheDocument()
  const back = within(hero).getByRole('button', { name: /Terhelés/ })
  fireEvent.click(back)
  expect(mockNavigate).toHaveBeenCalledWith('/train/week')
})

test('the gym-estimate and sport-logged boxes never mix into one number', async () => {
  const { container } = renderPage()
  await waitFor(() => expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull())
  const boxes = container.querySelectorAll('.ld-move-box')
  expect(boxes).toHaveLength(2)
  expect(within(boxes[0] as HTMLElement).getByText(/perc/)).toBeInTheDocument()
  expect(within(boxes[0] as HTMLElement).getByText(/gym/)).toBeInTheDocument()
  expect(within(boxes[1] as HTMLElement).getByText(/sport/)).toBeInTheDocument()
  expect(within(boxes[1] as HTMLElement).getByText(/naplóztad/)).toBeInTheDocument()
})

// With no weight on file, the gym side's kcal is honestly unknown — a number must never
// be fabricated where trainDayEnergy itself would return `known: false`.
test('movementWeek known:false renders the honest sentence, never a fabricated kcal', async () => {
  weightOverride = 0
  const { container } = renderPage()
  await waitFor(() => expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull())
  const gymBox = container.querySelectorAll('.ld-move-box')[0] as HTMLElement
  expect(within(gymBox).queryByText(/kcal/)).toBeNull()
  expect(within(gymBox).getByText(/nincs elég adat/)).toBeInTheDocument()
})

// Sport kcal has no data source at all (yet) — it must ALWAYS render the honest sentence,
// weight or no weight, never borrow the gym side's MET estimate.
test('the sport box never claims a kcal number it has no source for', async () => {
  const { container } = renderPage()
  await waitFor(() => expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull())
  const sportBox = container.querySelectorAll('.ld-move-box')[1] as HTMLElement
  expect(within(sportBox).queryByText(/kcal/)).toBeNull()
})

test('the group rows carry a "sport is" chip only where the sport/futás estimate reaches them', async () => {
  const { container } = renderPage()
  await waitFor(() => expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull())
  const groups = [...container.querySelectorAll('.ld-group.is-flat')] as HTMLElement[]
  expect(groups.length).toBeGreaterThan(0)
  const withChip = groups.filter((g) => within(g).queryByText('sport is') !== null)
  const withoutChip = groups.filter((g) => within(g).queryByText('sport is') === null)
  // At least one of each — the mock volleyball schedule reaches some groups (shoulder/quad/
  // calf/core), not the whole body (e.g. biceps-only groups stay chip-less).
  expect(withChip.length).toBeGreaterThan(0)
  expect(withoutChip.length).toBeGreaterThan(0)
})

test('the skeleton renders while the week\'s own detail fetch is still pending', () => {
  weekLogOverride = { details: [], pending: true }
  render(<QueryWrapper><MemoryRouter><TrainWeekMozgasPage /></MemoryRouter></QueryWrapper>)
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
})

// Fix round 1 (mezo-88iwa.13 review): goal/timing-profile pending must not block the whole
// page behind the skeleton — TrainTodayPage's precedent gates on workoutPending||runningPending
// only and lets the move boxes' own known:false fallback render the honest sentence.
test('goal/timing-profile still pending renders the page with the honest sentence, no skeleton', async () => {
  goalPendingOverride = true
  timingPendingOverride = true
  const { container } = renderPage()
  expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull()
  await waitFor(() => expect(container.querySelector('.ld-move-box')).not.toBeNull())
})

// Task 4 fix round 1 (review): the sport/run event list dropped from Task 3's migration
// — per-event tag, title, day/time and region-load chips, ported from MuscleWeekSheet's
// "Sport & futás terhelés" block onto this page's own honest section.
test('the sport/futás event list renders each event\'s title, day/time and a region-load chip', async () => {
  const { container } = renderPage()
  await waitFor(() => expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull())
  const events = [...container.querySelectorAll('.ld-event')] as HTMLElement[]
  expect(events.length).toBeGreaterThan(0)
  const first = events[0]
  expect(first.querySelector('.ld-event-tag')?.textContent).not.toBe('')
  expect(first.querySelector('.ld-event-title')?.textContent).not.toBe('')
  expect(first.querySelector('.ld-event-when')?.textContent).not.toBe('')
  expect(first.querySelectorAll('.ld-event-chip').length).toBeGreaterThan(0)
  expect(screen.getByText('Becslés, nem mérés.')).toBeInTheDocument()
})

test('the sport/futás event list renders the honest absence when the week has no events', async () => {
  sportLoadOverride = { perMuscle: {}, events: [] }
  const { container } = renderPage()
  await waitFor(() => expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull())
  expect(container.querySelectorAll('.ld-event').length).toBe(0)
  expect(screen.getByText('Nincs tervezett sport/futás esemény ezen a héten.')).toBeInTheDocument()
})
