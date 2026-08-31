// CharacterFeedPage — day-grouped rows + konzílium-diff rows (mezo-1gim.13, Task 4).
// Mode-agnostic via the KarakterHubPage.test.tsx hook-override idiom.
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CharacterFeedPage } from './CharacterFeedPage'
import { MOCK_EXPERTS, MOCK_FEED, MOCK_RUNS } from '@/data/character/characterMock'
import type { CharacterFeedItem, CharacterRunSummary } from '@/data/character/characterApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const hoisted = vi.hoisted(() => ({
  items: [] as CharacterFeedItem[],
  runs: [] as CharacterRunSummary[],
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterFeed: () => ({ items: hoisted.items, isLoading: false }),
    useCharacterExperts: () => ({ experts: MOCK_EXPERTS, isLoading: false }),
    useCharacterRuns: () => ({ runs: hoisted.runs, isLoading: false }),
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  // I1 (final review): MOCK_FEED's OBSERVATION `at` now mirrors production's write-lag — an
  // observation about Aug 30 is created ~Aug 31 02:5x, not on Aug 30 itself (see
  // characterMock.ts's MOCK_FEED header comment). "now" moves to Aug 31 evening so the newest
  // item (Doki, created Aug 31 02:52) still reads as "MA" / today.
  vi.setSystemTime(new Date('2026-08-31T20:00:00Z'))
  hoisted.items = MOCK_FEED
  // The real seeded run log covers every MOCK_FEED day (Aug 24–30) with a NIGHTLY row —
  // exercises the ⚙'s real resolve-by-date path against the actual mock corpus.
  hoisted.runs = MOCK_RUNS
  mockNavigate.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('CharacterFeedPage', () => {
  test('groups rows by day with HU labels (MA / TEGNAP / formatted date)', () => {
    render(<CharacterFeedPage />)
    expect(screen.getByText('MA')).toBeInTheDocument()
    expect(screen.getByText('TEGNAP')).toBeInTheDocument()
  })

  test('renders an observation row with the expert name and text', () => {
    render(<CharacterFeedPage />)
    expect(screen.getByText('Doki')).toBeInTheDocument()
    expect(screen.getByText(/A reggeli mérések három hete makulátlanul/)).toBeInTheDocument()
  })

  test('a "user" expertKey item gets the gold Te disc, never routed through PersonaOrb as Mezo', () => {
    hoisted.items = [
      { kind: 'OBSERVATION', at: '2026-08-30T09:00:00Z', expertKey: 'user', text: 'Daniel saját megfigyelése.' },
      ...MOCK_FEED,
    ]
    const { container } = render(<CharacterFeedPage />)
    expect(container.querySelectorAll('.kr-feeddisc.user')).toHaveLength(1)
    expect(screen.getAllByText('Te').length).toBeGreaterThan(0)
  })

  test('CONFERENCE_CHANGE items render as a coral diff row that navigates to the konzílium', () => {
    render(<CharacterFeedPage />)
    const diffRow = screen.getByText(/Vasárnapi konzílium/).closest('button')
    expect(diffRow).toHaveClass('kr-feeddiff')
    fireEvent.click(diffRow!)
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/konzilium')
  })

  test('an honestly empty feed renders no fabricated rows', () => {
    hoisted.items = []
    render(<CharacterFeedPage />)
    expect(screen.getByText(/nincs friss megfigyelés/)).toBeInTheDocument()
  })

  test('an observation row\'s ⚙ navigates to the matching NIGHTLY run for that date', async () => {
    render(<CharacterFeedPage />)
    // I1 (final review): MOCK_FEED's Doki row is created 2026-08-31T02:52:00Z (observed day
    // Aug 30, per the nightly job's write-lag) -> the join must resolve to the ejsz-30 nightly
    // run (day 2026-08-30), the "latest NIGHTLY day <= item's local date, within 1 day" rule —
    // an exact-date lookup would look for a (non-existent) Aug 31 run and find nothing.
    const row = screen.getByText(/A reggeli mérések három hete makulátlanul/).closest('.kr-feedrow')
    const gear = row!.querySelector('.kr-gepq') as HTMLButtonElement
    expect(gear).not.toBeNull()
    fireEvent.click(gear)
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem/futas/ejsz-30')
  })

  test('I1: a run more than 1 day stale is an honest gap, never silently matched', () => {
    // Only a run for Aug 20 exists — the Doki item's local date is Aug 31 (created-at, per the
    // mock's write-lag), 11 days away. The old exact-date bug and a naive "nearest run" fix would
    // both be wrong here in different ways; the 1-day window must refuse this match entirely.
    hoisted.runs = [{
      id: 'ejsz-20', kind: 'NIGHTLY', day: '2026-08-20', observationCount: 1, callCount: 1,
      detectorKeys: ['logging-gap'], expertKeys: ['drill'], conferenceId: null,
    }]
    render(<CharacterFeedPage />)
    const row = screen.getByText(/A reggeli mérések három hete makulátlanul/).closest('.kr-feedrow')
    expect(row!.querySelector('.kr-gepq')).toBeNull()
  })

  test('I1: an item created same-day as the run (diff 0) still resolves', () => {
    hoisted.items = [
      { kind: 'OBSERVATION', at: '2026-08-20T18:00:00Z', expertKey: 'drill', text: 'Aznapi megfigyelés.' },
    ]
    hoisted.runs = [{
      id: 'ejsz-20', kind: 'NIGHTLY', day: '2026-08-20', observationCount: 1, callCount: 1,
      detectorKeys: ['logging-gap'], expertKeys: ['drill'], conferenceId: null,
    }]
    render(<CharacterFeedPage />)
    const row = screen.getByText(/Aznapi megfigyelés/).closest('.kr-feedrow')
    const gear = row!.querySelector('.kr-gepq') as HTMLButtonElement
    expect(gear).not.toBeNull()
    fireEvent.click(gear)
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem/futas/ejsz-20')
  })

  test('no ⚙ when no run row exists for the observation\'s date — honest absence, not a dead button', () => {
    hoisted.runs = [] // no run log at all for any date in the feed
    render(<CharacterFeedPage />)
    const row = screen.getByText(/A reggeli mérések három hete makulátlanul/).closest('.kr-feedrow')
    expect(row!.querySelector('.kr-gepq')).toBeNull()
  })

  test('CONFERENCE_CHANGE rows never get a ⚙ — they keep linking to the transcript', () => {
    render(<CharacterFeedPage />)
    const diffRow = screen.getByText(/Vasárnapi konzílium/).closest('.kr-feeddiff')
    expect(diffRow!.querySelector('.kr-gepq')).toBeNull()
  })
})
