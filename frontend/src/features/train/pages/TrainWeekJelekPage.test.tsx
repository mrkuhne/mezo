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

const READY = 'Egy régió — egy sziluett. A kiemelt rész mondja meg, melyik fejről van szó.'

test('the hero carries the prototype label, verdict and lead', async () => {
  const { container } = renderPage()
  await screen.findByText(READY)
  const hero = container.querySelector('.fo-hero') as HTMLElement
  expect(within(hero).getByText('Izomtérkép · minden izomcsoport, saját jellel')).toHaveClass('fo-hero-lbl')
  expect(within(hero).getByText('Ezen a héten még egy izmod sincs naplózva.')).toHaveClass('fo-hero-verdict')
  expect(within(hero).getByText(READY)).toHaveClass('fo-hero-sub')
})

test('the back pill reads „‹ Izomtérkép" and returns to the map', async () => {
  renderPage()
  await screen.findByText(READY)
  const back = screen.getByRole('button', { name: /Izomtérkép/ })
  expect(back).toHaveClass('fo-backpill')
  expect(back.textContent).toBe('‹ Izomtérkép')
  fireEvent.click(back)
  expect(mockNavigate).toHaveBeenCalledWith('/train/week/terkep')
})

test('six region sections, the prototype\'s exact counts, all 21 muscles', async () => {
  const { container } = renderPage()
  await screen.findByText(READY)
  const regions = [...container.querySelectorAll('.et-region')]
  expect(regions.length).toBe(6)

  const expected: Array<[string, number]> = [
    ['Mell', 3], ['Hát', 4], ['Váll', 3], ['Kar', 6], ['Láb', 4], ['Core', 1],
  ]
  expected.forEach(([label, count], i) => {
    expect(regions[i].querySelector('.fo-sec')!.textContent).toBe(`${i + 1}${label} · ${count} izom`)
    expect(regions[i].querySelectorAll('.fo-card .et-mm .et-sign').length).toBe(count)
  })

  const cells = [...container.querySelectorAll('.et-sign')]
  expect(cells.length).toBe(21)
  expect(cells.map((c) => c.getAttribute('data-muscle'))).toEqual(LIVE_MUSCLES)
  // Every cell draws its own silhouette through the shipped MuscleChip path (on white through
  // Mchp) — never an emoji, never a second geometry path.
  await waitFor(() => expect(container.querySelectorAll('.et-sign .ex-mchp svg.muscle-chip').length).toBe(21))
})

// The hero's one graphic: a tube per region, its level = how many of its muscles were worked.
test('the hero holds one tube per region with its worked / all count', async () => {
  weekLogOverride = [loggedWorkout('chest-mid')]
  const { container } = renderPage()
  await screen.findByText(READY)
  const tubes = [...container.querySelectorAll('.fo-hero .et-regions .fo-vial')] as HTMLElement[]
  expect(tubes.map((t) => t.querySelector('small')!.textContent)).toEqual(['Mell', 'Hát', 'Váll', 'Kar', 'Láb', 'Core'])
  expect(tubes.map((t) => t.querySelector('b')!.textContent)).toEqual(['1/3', '0/4', '0/3', '0/6', '0/4', '0/1'])
  // a dry tube at zero, liquid where there is work
  expect(tubes[0].querySelector('.fo-tube .l')).not.toBeNull()
  expect(tubes[1].querySelector('.fo-tube .l')).toBeNull()
  expect(screen.getByText('1 izmon dolgoztál már ezen a héten a 21-ből.')).toHaveClass('fo-hero-verdict')
  expect(screen.getByText('A teli jelek azok az izmok, amiken ezen a héten már dolgoztál.')).toBeInTheDocument()
})

test('a muscle worked this week is marked live; one that was not stays pale', async () => {
  weekLogOverride = [loggedWorkout('chest-mid')]
  const { container } = renderPage()
  await screen.findByText(READY)
  const cell = (token: string) => container.querySelector(`.et-sign[data-muscle="${token}"]`) as HTMLElement
  expect(cell('chest-mid')).toHaveClass('is-live')
  expect(cell('chest-upper')).not.toHaveClass('is-live')
  expect(cell('quad')).not.toHaveClass('is-live')
  expect(container.querySelectorAll('.et-sign.is-live').length).toBe(1)
})

// The honesty cut: a week whose only logged set was SKIPPED worked nothing, and the page
// must not light the cell on the strength of the exercise merely appearing in the log.
test('a skipped-only logged exercise lights nothing, and the page says the week is empty', async () => {
  const skipped = loggedWorkout('chest-mid')
  skipped.exercises[0].sets[0].skipped = true
  weekLogOverride = [skipped]
  const { container } = renderPage()
  await screen.findByText(READY)
  expect(container.querySelectorAll('.et-sign.is-live').length).toBe(0)
  expect(screen.getByText(/még egy izmod sincs naplózva/)).toBeInTheDocument()
  expect(screen.getByText('Amint egy edzés lezárul, a jele megtelik.')).toBeInTheDocument()
})

test('mock-empty honesty: with no logged week nothing is lit and no active set is fabricated', async () => {
  const { container } = renderPage()
  await screen.findByText(READY)
  expect(container.querySelectorAll('.et-sign.is-live').length).toBe(0)
  expect(container.querySelectorAll('.et-regions .fo-tube .l')).toHaveLength(0)
})

test('folyadék: no old sign classes, no glass', async () => {
  const { container } = renderPage()
  await screen.findByText(READY)
  expect(container.querySelector('[class*="mm-"], [class*="ld-"], [class*="tw-"], .mz-page, .glass')).toBeNull()
})

test('the Terhelés tab stays lit on /train/week/jelek', () => {
  const train = domainById('train')!
  expect(activeTabRoute(train, '/train/week/jelek')).toBe('/train/week')
})
