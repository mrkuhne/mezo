import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { WeekPage } from '@/features/me/pages/WeekPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { mockMeWeekStart } from '@/data/me/meWeek'

// One test forces a null weekly score to exercise the "tanulom" hero branch — the mock seed's
// weekly score is always 78, so that branch is otherwise unreachable in mock mode. Idiom mirrors
// FuelMaiPage.test's hoisted single-hook override. The same override point lets the
// weekly-review tests force a `stale` review (the mock seed is never stale) and a spinning
// `regenerating` state without a real backend.
const hoisted = vi.hoisted(() => ({
  forceNullScore: false,
  forceStale: false,
  forceRegenerating: false,
  regenerateSpy: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useMeWeek: (startIso: string) => {
      const real = actual.useMeWeek(startIso)
      if (!hoisted.forceNullScore || !real.week) return real
      return { ...real, week: { ...real.week, weekly: { ...real.week.weekly, score: null, prevWeekScore: null } } }
    },
    useWeeklyReview: (startIso: string) => {
      const real = actual.useWeeklyReview(startIso)
      if ((!hoisted.forceStale && !hoisted.forceRegenerating) || !real.review) return real
      return {
        ...real,
        review: { ...real.review, stale: hoisted.forceStale || real.review.stale },
        regenerate: hoisted.regenerateSpy,
        regenerating: hoisted.forceRegenerating,
      }
    },
  }
})

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  vi.unstubAllEnvs()
  hoisted.forceNullScore = false
  hoisted.forceStale = false
  hoisted.forceRegenerating = false
  hoisted.regenerateSpy.mockClear()
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

test('current (ungenerated) week shows the review ghost placeholder', () => {
  renderPage()
  expect(screen.getByText('Hétfő reggel érkezik — a Mezo a lezárt hét adataiból írja meg.')).toBeInTheDocument()
})

test('a generated past week renders the review summary, its feedback chips and day notes', () => {
  renderPage(`/me/week?start=${mockMeWeekStart}`)
  expect(screen.getByText(/Erős hét volt/)).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Visszajelzés a heti elemzésről' })).toBeInTheDocument()
  // Expand the first day card (Hétfő) — it carries a dayNote in the seed.
  const first = screen.getAllByTestId('week-day-card')[0]
  fireEvent.click(first.querySelector('button')!)
  expect(screen.getByText(/Hétfőn erős edzésnap volt/)).toBeInTheDocument()
})

test('a stale review shows the refresh button; clicking it calls regenerate and shows a spinner while pending', () => {
  hoisted.forceStale = true
  renderPage(`/me/week?start=${mockMeWeekStart}`)
  const button = screen.getByRole('button', { name: 'Frissítsd az elemzést' })
  fireEvent.click(button)
  expect(hoisted.regenerateSpy).toHaveBeenCalledTimes(1)

  hoisted.forceRegenerating = true
  renderPage(`/me/week?start=${mockMeWeekStart}`)
  expect(screen.getByRole('button', { name: 'Frissítés…' })).toBeDisabled()
})

test('discoveries only render non-empty subsections, with pattern/fact/memoir links', () => {
  renderPage(`/me/week?start=${mockMeWeekStart}`)
  expect(screen.getByText('Edzésnapokon jobban alszol')).toBeInTheDocument()
  const patternLink = screen.getByText('Edzésnapokon jobban alszol').closest('a')
  expect(patternLink).toHaveAttribute('href', '/insights/patterns/sleep_workout')
  const factLink = screen.getByText('A fehérjecél tartása javítja a check-in energiát.').closest('a')
  expect(factLink).toHaveAttribute('href', '/insights/knowledge')
  const memoirLink = screen.getByText('Új bejegyzés készült a hétről').closest('a')
  expect(memoirLink).toHaveAttribute('href', '/insights/memoir')
  // Life events render as plain (unlinked) rows.
  expect(screen.getByText('Nyaralás kezdete')).toBeInTheDocument()
})

test('the next-week card shows the weekly-suggestion prose under its eyebrow, current week only', () => {
  renderPage()
  expect(screen.getByText('Mezo · a következő heted')).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Visszajelzés a heti tervjavaslatról' })).toBeInTheDocument()
})

test('the next-week card is absent when browsing a past week — its content is unrelated to that week', () => {
  renderPage(`/me/week?start=${mockMeWeekStart}`)
  expect(screen.queryByText('Mezo · a következő heted')).not.toBeInTheDocument()
})
