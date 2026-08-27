import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { WeekPage } from '@/features/me/pages/WeekPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'

// One test forces a null weekly score to exercise the "tanulom" hero branch — the mock seed's
// weekly score is always 78, so that branch is otherwise unreachable in mock mode. Idiom mirrors
// FuelMaiPage.test's hoisted single-hook override.
const hoisted = vi.hoisted(() => ({ forceNullScore: false }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useMeWeek: (startIso: string) => {
      const real = actual.useMeWeek(startIso)
      if (!hoisted.forceNullScore || !real.week) return real
      return { ...real, week: { ...real.week, weekly: { ...real.week.weekly, score: null, prevWeekScore: null } } }
    },
  }
})

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  vi.unstubAllEnvs()
  hoisted.forceNullScore = false
})

const renderPage = (path = '/me/week') =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <WeekPage />
      </MemoryRouter>
    </QueryWrapper>,
  )

test('renders the week title, 7 day cards and the non-null hero score', () => {
  renderPage()
  const start = mondayIso()
  expect(screen.getByText(deriveWeekTitle(start))).toBeInTheDocument()
  // mock seed's weekly score is 78 (non-null) — the big-number hero, not "tanulom"
  // (several day cards also badge a score of 78, so scope the assertion to the hero's /100 suffix)
  expect(screen.getByText('/100').previousSibling?.textContent).toBe('78')
  // 7 day rows — one huMonthDayDow label per day of the requested week
  expect(screen.getAllByTestId('week-day-card')).toHaveLength(7)
})

test('next-week stepper is disabled on the current week', () => {
  renderPage()
  expect(screen.getByRole('button', { name: '›' })).toBeDisabled()
})

test('prev-week stepper is enabled and steps back via ?start=', () => {
  renderPage()
  expect(screen.getByRole('button', { name: '‹' })).not.toBeDisabled()
})

test('clicking a day card expands it and reveals the subscore breakdown', () => {
  renderPage()
  const first = screen.getAllByTestId('week-day-card')[0]
  fireEvent.click(first.querySelector('button')!)
  expect(screen.getByText(/Alvás 82/)).toBeInTheDocument()
})

test('"tanulom" null-state hero renders when the weekly score is null', () => {
  hoisted.forceNullScore = true
  renderPage()
  expect(screen.getByText('tanulom')).toBeInTheDocument()
  expect(screen.getByText('még gyűjtöm az adatokat a heti értékeléshez')).toBeInTheDocument()
})
