import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TrainWeekJelekPage } from '@/features/train/pages/TrainWeekJelekPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { activeTabRoute, domainById } from '@/app/navModel'
import { LIVE_MUSCLES } from '@/features/train/logic/muscleColors'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock mode persists no workout instances at all (weekMuscleLogHooks header note), so the
// "a worked muscle lights, an unworked one does not" test has to hand the page a real
// logged week — the same override rig TrainWeekMapPage.test.tsx uses.
let weekLogOverride: WorkoutDetailResponse[] | null = null
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
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
  weekLogOverride = null
})

const renderPage = () => render(<QueryWrapper><MemoryRouter><TrainWeekJelekPage /></MemoryRouter></QueryWrapper>)

/** One logged, completed workout carrying a single real working set on `muscle`. */
function loggedWorkout(muscle: string): WorkoutDetailResponse {
  return {
    id: 'w-1', templateSessionId: 'ts-1', date: '2026-05-20', status: 'completed',
    title: 'Push', dayLabel: 'Hét',
    exercises: [{
      exerciseId: 'e-1', name: 'Bench', muscle, type: 'compound',
      warmupSets: 0, workingSets: 1, repMin: 8, repMax: 10, targetRIR: 2, skipped: false,
      sets: [{ id: 's1', exerciseId: 'e-1', setIndex: 0, reps: 8, rir: 2, skipped: false, kind: 'working' }],
    }],
  } as unknown as WorkoutDetailResponse
}

test('the head carries the prototype eyebrow, strong line and lead verbatim', async () => {
  const { container } = renderPage()
  await screen.findByText('Minden izomcsoport, saját jellel')
  const head = container.querySelector('.mm-head') as HTMLElement
  expect(head).not.toBeNull()
  expect(within(head).getByText('Izomtérkép')).toHaveClass('ld-eyebrow')
  expect(within(head).getByText('Egy régió — egy sziluett. A kiemelt rész mondja meg, melyik fejről van szó.')).toBeInTheDocument()
})

test('the back pill reads „‹ Izomtérkép" and is docked inside the hero', async () => {
  const { container } = renderPage()
  await screen.findByText('Minden izomcsoport, saját jellel')
  const hero = container.querySelector('.ld-hero.is-slim') as HTMLElement
  expect(hero).not.toBeNull()
  const back = within(hero).getByRole('button', { name: /Izomtérkép/ })
  expect(back).toHaveClass('ld-back')
  fireEvent.click(back)
  expect(mockNavigate).toHaveBeenCalledWith('/train/week/terkep')
})

test('six region blocks, the prototype\'s exact counts, all 21 muscles', async () => {
  const { container } = renderPage()
  await screen.findByText('Minden izomcsoport, saját jellel')
  const regions = [...container.querySelectorAll('.mm-region')]
  expect(regions.length).toBe(6)

  const expected: Array<[string, number]> = [
    ['Mell', 3], ['Hát', 4], ['Váll', 3], ['Kar', 6], ['Láb', 4], ['Core', 1],
  ]
  expected.forEach(([label, count], i) => {
    const head = regions[i].querySelector('.mm-region-head') as HTMLElement
    expect(within(head).getByText(label)).toBeInTheDocument()
    expect(within(head).getByText(`${count} izom`)).toBeInTheDocument()
    expect(regions[i].querySelectorAll('.mm-grid .mm-cell').length).toBe(count)
  })

  const cells = [...container.querySelectorAll('.mm-cell')]
  expect(cells.length).toBe(21)
  expect(cells.map((c) => c.getAttribute('data-muscle'))).toEqual(LIVE_MUSCLES)
  // Every cell draws its own silhouette through the shipped MuscleChip path — never an
  // emoji, never a second geometry path.
  await waitFor(() => expect(container.querySelectorAll('.mm-cell svg.muscle-chip').length).toBe(21))
})

test('a muscle worked this week is marked live; one that was not stays unlit', async () => {
  weekLogOverride = [loggedWorkout('chest-mid')]
  const { container } = renderPage()
  await screen.findByText('Minden izomcsoport, saját jellel')
  const cell = (token: string) => container.querySelector(`.mm-cell[data-muscle="${token}"]`) as HTMLElement
  expect(cell('chest-mid')).toHaveClass('is-live')
  expect(cell('chest-upper')).not.toHaveClass('is-live')
  expect(cell('quad')).not.toHaveClass('is-live')
  expect(container.querySelectorAll('.mm-cell.is-live').length).toBe(1)
})

// The honesty cut: a week whose only logged set was SKIPPED worked nothing, and the page
// must not light the cell on the strength of the exercise merely appearing in the log.
test('a skipped-only logged exercise lights nothing, and the page says the week is empty', async () => {
  const skipped = loggedWorkout('chest-mid')
  skipped.exercises[0].sets[0].skipped = true
  weekLogOverride = [skipped]
  const { container } = renderPage()
  await screen.findByText('Minden izomcsoport, saját jellel')
  expect(container.querySelectorAll('.mm-cell.is-live').length).toBe(0)
  expect(screen.getByText(/még egy izmod sincs naplózva/)).toBeInTheDocument()
})

test('mock-empty honesty: with no logged week nothing is lit and no active set is fabricated', async () => {
  const { container } = renderPage()
  await screen.findByText('Minden izomcsoport, saját jellel')
  expect(container.querySelectorAll('.mm-cell.is-live').length).toBe(0)
})

test('the Terhelés tab stays lit on /train/week/jelek', () => {
  const train = domainById('train')!
  expect(activeTabRoute(train, '/train/week/jelek')).toBe('/train/week')
})
