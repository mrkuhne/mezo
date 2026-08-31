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
  vi.setSystemTime(new Date('2026-08-30T20:00:00Z'))
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
    // MOCK_FEED's 2026-08-30T08:10:00Z Doki row -> the seeded ejsz-30 nightly run.
    const row = screen.getByText(/A reggeli mérések három hete makulátlanul/).closest('.kr-feedrow')
    const gear = row!.querySelector('.kr-gepq') as HTMLButtonElement
    expect(gear).not.toBeNull()
    fireEvent.click(gear)
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem/futas/ejsz-30')
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
