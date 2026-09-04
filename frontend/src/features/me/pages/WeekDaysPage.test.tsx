import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { WeekDaysPage } from '@/features/me/pages/WeekDaysPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// A hét napjai (mezo-d20.6.10) — the day mosaic at /me/week/napok. Prototype `#page-hdays`.
// The clock is pinned so "today" (and therefore which days are FUTURE) is deterministic:
// 2026-05-21 is the Thursday of the mock seed week that starts 2026-05-18.
const NOW = new Date('2026-05-21T10:00:00')
const PAST_WEEK = '2026-05-11'   // fully in the past → no future days, review exists
const CURRENT_WEEK = '2026-05-18' // contains today → Fri/Sat/Sun are still ahead

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderPage(start: string) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/me/week/napok?start=${start}`]}>
        <Routes><Route path="/me/week/napok" element={<WeekDaysPage />} /></Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

beforeEach(() => {
  mockNavigate.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('WeekDaysPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('renders the hero, the mini-cells, one tile per day, the legend and the footnote', () => {
    const { container } = renderPage(PAST_WEEK)
    expect(screen.getByText('A hét napjai')).toBeInTheDocument()
    expect(screen.getByText('mért nap · koppints egy csempére')).toBeInTheDocument()
    // 5 measured days in the seed week (two are unscored) — never 7, never 0
    expect(container.querySelector('.mz-bignum')).toHaveTextContent('5 / 7')

    expect(screen.getByText('legjobb nap')).toBeInTheDocument()
    expect(screen.getByText('Sze 85')).toBeInTheDocument()
    expect(screen.getByText('leggyengébb')).toBeInTheDocument()
    expect(screen.getByText('Kedd 72')).toBeInTheDocument()
    expect(screen.getAllByText('tanulom').length).toBeGreaterThan(0) // the mini-cell label

    expect(screen.getAllByTestId('week-day-tile')).toHaveLength(7)
    // legend — mezo-jcpt.5: hat sub-jel (nutrition/quality/training/sleep/logging/rhythm)
    expect(screen.getByText('edzés')).toBeInTheDocument()
    expect(screen.getByText('ritmus')).toBeInTheDocument()
    expect(screen.getByText(/A négy pálcika a nap részpontszáma/)).toBeInTheDocument()
  })

  test('CONTRACT — a day with fewer than two sub-scores says `tanulom`, not a zero', () => {
    const { container } = renderPage(PAST_WEEK)
    // 2026-05-14 = the seed's sparse day (check-ins only, one sub-score)
    const thin = container.querySelector('[data-date="2026-05-14"]')!
    expect(thin.className).toContain('is-thin')
    expect(within(thin as HTMLElement).getByText('tanulom')).toBeInTheDocument()
    expect(within(thin as HTMLElement).getByText('kevesebb mint két területről van adat, ezért nincs pontszám'))
      .toBeInTheDocument()
    expect(within(thin as HTMLElement).queryByText('0')).not.toBeInTheDocument()
    // it DID log check-ins — the chip proves the state is not "nothing happened"
    expect(within(thin as HTMLElement).getByText('2/4')).toBeInTheDocument()
  })

  test('CONTRACT — a day with nothing logged says `nincs adat`, a DIFFERENT state', () => {
    const { container } = renderPage(PAST_WEEK)
    // 2026-05-16 = the seed's genuinely empty day
    const empty = container.querySelector('[data-date="2026-05-16"]')!
    expect(within(empty as HTMLElement).getByText('nincs adat')).toBeInTheDocument()
    expect(within(empty as HTMLElement).getByText('ezen a napon nem logoltál — a hét pontszámába nem számít bele'))
      .toBeInTheDocument()
    // and it is NOT the tanulom sentence
    expect(within(empty as HTMLElement).queryByText(/kevesebb mint két területről/)).not.toBeInTheDocument()
  })

  test('CONTRACT — a day still ahead is faded, dashed and unclickable', () => {
    const { container } = renderPage(CURRENT_WEEK)
    const future = container.querySelector('[data-date="2026-05-23"]')!
    expect(future.className).toContain('is-future')
    expect(future.tagName).toBe('DIV') // not a button — nothing to open yet
    expect(within(future as HTMLElement).getByText('még előtted — ide majd a nap adatai jönnek')).toBeInTheDocument()
  })

  test('the analysis note surfaces as the lavender `jegyzet` chip, only where it wrote', () => {
    const { container } = renderPage(PAST_WEEK)
    // seed dayNotes sit at offsets 0,1,2,4,6 — offset 3 (2026-05-14) has none
    expect(within(container.querySelector('[data-date="2026-05-11"]') as HTMLElement).getByText('jegyzet'))
      .toBeInTheDocument()
    expect(within(container.querySelector('[data-date="2026-05-14"]') as HTMLElement).queryByText('jegyzet'))
      .not.toBeInTheDocument()
  })

  test('a tile does NOT expand in place — it deep-links to the day page, week in tow', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = renderPage(PAST_WEEK)
    await user.click(container.querySelector('[data-date="2026-05-13"]') as HTMLElement)
    expect(mockNavigate).toHaveBeenCalledWith('/me/week/napok/2026-05-13?start=2026-05-11')
    // nothing grew inside the grid
    expect(screen.getAllByTestId('week-day-tile')).toHaveLength(7)
  })
})

describe('WeekDaysPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('renders the FETCHED week, never the mock seed', async () => {
    renderPage(PAST_WEEK)
    // the MSW week: one scored day (65) + six honest-empty days
    expect(await screen.findByText('65')).toBeInTheDocument()
    expect(screen.queryByText('85')).not.toBeInTheDocument() // the seed's Wednesday
    await waitFor(() => expect(screen.getAllByTestId('week-day-tile')).toHaveLength(7))
    expect(screen.getAllByText('nincs adat')).toHaveLength(6)
  })

  test('a failed fetch is a retryable error state, not an empty week', async () => {
    server.use(http.get(`${API_BASE}/api/me/week/:start`, () => new HttpResponse(null, { status: 500 })))
    renderPage(PAST_WEEK)
    expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült betölteni a hét adatait.')
    expect(screen.getByRole('button', { name: 'Próbáld újra' })).toBeInTheDocument()
    expect(screen.queryByTestId('week-day-tile')).not.toBeInTheDocument()
  })
})
