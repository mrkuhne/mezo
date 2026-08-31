// FutasokPage — week stepper, month-jump menu, day-grouped rows, missing-day honesty, and the
// rare-runs (MONTHLY/BOOTSTRAP) section (mezo-1gim.14, Task 4). Mode-agnostic via the
// KarakterHubPage.test.tsx hook-override idiom.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { FutasokPage } from './FutasokPage'
import type { CharacterRunSummary } from '@/data/character/characterApi'

const mockNavigate = vi.fn()
let searchParams = new URLSearchParams()
const setSearchParams = vi.fn((next: Record<string, string>) => {
  searchParams = new URLSearchParams(next)
})
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [searchParams, setSearchParams],
  }
})

const hoisted = vi.hoisted(() => ({
  weekRuns: [] as CharacterRunSummary[],
  rareRuns: [] as CharacterRunSummary[],
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    // The page fires two useCharacterRuns calls (the browsed week + the 62-day rare-runs
    // window) — distinguished by the requested span: >7 days is the rare-runs call.
    useCharacterRuns: (fromIso: string, toIso: string) => {
      const days = (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000
      return { runs: days > 7 ? hoisted.rareRuns : hoisted.weekRuns, isLoading: false }
    },
  }
})

const NIGHTLY_QUIET = (day: string): CharacterRunSummary => ({
  id: `ejsz-${day}`, kind: 'NIGHTLY', day: `2026-08-${day}`, observationCount: 0, callCount: 0,
  detectorKeys: [], expertKeys: [], conferenceId: null,
})
const NIGHTLY_SIGNAL: CharacterRunSummary = {
  id: 'ejsz-27', kind: 'NIGHTLY', day: '2026-08-27', observationCount: 2, callCount: 2,
  detectorKeys: ['journal-note'], expertKeys: ['pszichologus', 'taplalkozo'], conferenceId: null,
}
const WEEKLY: CharacterRunSummary = {
  id: 'run-w2', kind: 'WEEKLY', day: '2026-08-24', observationCount: 7, callCount: 0,
  detectorKeys: [], expertKeys: ['doki'], conferenceId: 'w2',
}
const MONTHLY: CharacterRunSummary = {
  id: 'run-m1', kind: 'MONTHLY', day: '2026-08-01', observationCount: 16, callCount: 0,
  detectorKeys: [], expertKeys: ['mezo'], conferenceId: 'm1',
}

beforeEach(() => {
  searchParams = new URLSearchParams({ start: '2026-08-24' })
  hoisted.weekRuns = [WEEKLY, NIGHTLY_SIGNAL, NIGHTLY_QUIET('24'), NIGHTLY_QUIET('25')]
  hoisted.rareRuns = [MONTHLY]
  mockNavigate.mockReset()
  setSearchParams.mockClear()
})

const renderPage = () => render(<FutasokPage />)

describe('FutasokPage', () => {
  test('renders day-grouped rows with kind badges and honest one-line counts', () => {
    renderPage()
    expect(screen.getByText('Futások')).toBeInTheDocument()
    expect(screen.getAllByText('ÉJSZAKAI').length).toBeGreaterThan(0)
    expect(screen.getByText('HETI')).toBeInTheDocument()
    expect(screen.getByText('2 megfigyelés · 2 szakértő hívva')).toBeInTheDocument()
    expect(screen.getByText('7 megfigyelés feldolgozva')).toBeInTheDocument()
  })

  test('a day with no run row at all shows the honest "nincs adat" line — not a fabricated quiet night', () => {
    // 2026-08-26, -28, -29, -30 have no row in `weekRuns` — 4 missing days this week.
    renderPage()
    expect(screen.getAllByText('nincs adat erről az éjszakáról')).toHaveLength(4)
  })

  test('a real zero-count NIGHTLY row renders proudly as "csendes nap", distinct from a missing day', () => {
    renderPage()
    // 24 and 25 are both real zero-count NIGHTLY rows in this fixture.
    expect(screen.getAllByText('csendes nap · 0 hívás')).toHaveLength(2)
  })

  test('clicking a run row navigates to its detail page', async () => {
    renderPage()
    await userEvent.click(screen.getByText('2 megfigyelés · 2 szakértő hívva').closest('button')!)
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem/futas/ejsz-27')
  })

  test('the week stepper moves the ?start= param by ±7 days', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Előző hét' }))
    expect(setSearchParams).toHaveBeenCalledWith({ start: '2026-08-17' }, { replace: true })
  })

  // Fix round 1 (a11y): the week-label button's `aria-label="Hét választása"` is gone — its
  // accessible name is now its own visible content (the browsed week range + status text),
  // so the open-menu trigger is queried by that text instead of the retired label. Scoped to
  // `.kr-weeklbl-btn` specifically — once the jump menu is open, one of its chips can carry
  // the SAME "aug. 24. – aug. 30." text (whenever the real wall-clock "current week" puts
  // 2026-08-24 among the last-8-Mondays list), so a bare text match is ambiguous.
  const weekLabelBtn = () => document.querySelector('.kr-weeklbl-btn')!

  test('the week label opens a jump menu of recent weeks', async () => {
    renderPage()
    await userEvent.click(weekLabelBtn())
    expect(screen.getByRole('button', { name: /Előző hét/ })).toBeInTheDocument() // stepper still there
    // At least one other week chip is now visible.
    expect(screen.getAllByRole('button').length).toBeGreaterThan(3)
  })

  test('clicking outside the jump menu dismisses it', async () => {
    renderPage()
    await userEvent.click(weekLabelBtn())
    expect(weekLabelBtn()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(document.body)
    expect(weekLabelBtn()).toHaveAttribute('aria-expanded', 'false')
  })

  test('Escape dismisses the jump menu', async () => {
    renderPage()
    await userEvent.click(weekLabelBtn())
    expect(weekLabelBtn()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    expect(weekLabelBtn()).toHaveAttribute('aria-expanded', 'false')
  })

  test('rare runs (MONTHLY/BOOTSTRAP) render under "Ritkább futások", separate from the week list', () => {
    renderPage()
    expect(screen.getByText('Ritkább futások')).toBeInTheDocument()
    expect(screen.getByText('Havi mélyolvasás')).toBeInTheDocument()
    expect(screen.getByText(/16 állítás újramérlegelve/)).toBeInTheDocument()
  })

  describe('M8 (final review): future days inside the current week', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      // "today" = Aug 26 (a Wednesday), inside the browsed 24–30 week — so 27–30 are future.
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))
    })
    afterEach(() => vi.useRealTimers())

    test('a future day (no run row) renders "még nem jött el", never "nincs adat"', () => {
      renderPage()
      // "today" = Aug 26. Missing days this week: 26, 28, 29, 30 (27 has a real NIGHTLY_SIGNAL
      // row, so it isn't "missing" at all). TODAY counts as "future" too (M8): the nightly job
      // processes YESTERDAY (I1's write-lag), so today's own row is only written tomorrow — a
      // missing row for today is expected, not a pipeline failure, same honest fact as a later
      // day. All 4 missing days (26, 28, 29, 30) get the future line; none get "nincs adat".
      expect(screen.getAllByText('még nem jött el')).toHaveLength(4)
      expect(screen.queryByText('nincs adat erről az éjszakáról')).not.toBeInTheDocument()
    })

    test('today\'s row header shows the "MA" marker instead of the weekday abbreviation', () => {
      renderPage()
      expect(screen.getByText('MA')).toBeInTheDocument()
      expect(screen.queryByText('SZE')).not.toBeInTheDocument() // "szerda" (Wednesday) abbreviation, suppressed for today
    })
  })
})
