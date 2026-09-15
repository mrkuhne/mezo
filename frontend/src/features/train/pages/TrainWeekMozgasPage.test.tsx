import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { TrainWeekMozgasPage } from '@/features/train/pages/TrainWeekMozgasPage'
import { QueryWrapper } from '@/test/queryWrapper'

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
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useGoal: (...args: Parameters<typeof actual.useGoal>) => {
      const real = actual.useGoal(...args)
      if (weightOverride === undefined) return real
      return { ...real, goal: real.goal ? { ...real.goal, currentWeight: weightOverride } : real.goal, goalResponse: null }
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
