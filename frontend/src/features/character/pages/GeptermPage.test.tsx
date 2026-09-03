// GeptermPage — the geek-transparency hub's 4 tiles + last-run hero line (mezo-1gim.14, Task 4).
// Mode-agnostic via the KarakterHubPage.test.tsx hook-override idiom.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { GeptermPage } from './GeptermPage'
import type { CharacterRunSummary } from '@/data/character/characterApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const hoisted = vi.hoisted(() => ({
  runs: [] as CharacterRunSummary[],
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterRuns: () => ({ runs: hoisted.runs, isLoading: false }),
  }
})

const NIGHTLY_QUIET: CharacterRunSummary = {
  id: 'ejsz-30', kind: 'NIGHTLY', day: '2026-08-30', observationCount: 0, callCount: 0,
  detectorKeys: [], expertKeys: [], conferenceId: null,
}
const NIGHTLY_SIGNAL: CharacterRunSummary = {
  id: 'ejsz-27', kind: 'NIGHTLY', day: '2026-08-27', observationCount: 2, callCount: 2,
  detectorKeys: ['journal-note', 'logging-gap'], expertKeys: ['pszichologus', 'taplalkozo'], conferenceId: null,
}
const MONTHLY_RUN: CharacterRunSummary = {
  id: 'run-m1', kind: 'MONTHLY', day: '2026-08-01', observationCount: 23, callCount: 0,
  detectorKeys: [], expertKeys: ['mezo'], conferenceId: 'm1',
}

beforeEach(() => {
  hoisted.runs = [NIGHTLY_QUIET, NIGHTLY_SIGNAL]
  mockNavigate.mockReset()
})

const renderHub = () => render(<GeptermPage />)

describe('GeptermPage', () => {
  test('renders the 4 tiles + the last run\'s plain-language hero line', () => {
    renderHub()
    expect(screen.getByText('Gépterem')).toBeInTheDocument()
    expect(screen.getByText(/csendes nap · 0 hívás/)).toBeInTheDocument() // runs[0] = the latest
    // Fix round 1 (a11y): tile `aria-label`s are gone — a tile's accessible name is now its
    // own text content (eyebrow + the live line), so name queries match on both.
    expect(screen.getByRole('button', { name: /Futások.*futás.*megfigyelés/ })).toBeInTheDocument()
    expect(screen.getByText('Adatforrások')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /AI-napló.*minden hívás tárolva/ })).toBeInTheDocument()
    expect(screen.getByText('Detektorok')).toBeInTheDocument()
  })

  test('Futások tile navigates to the Futások list', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: /Futások/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem/futasok')
  })

  test('AI-napló tile navigates to /me/ai-usage unfiltered (AiCallFilters is not URL-driven)', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: /AI-napló/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/ai-usage')
  })

  test('Adatforrások tile navigates to the Adatforrások page (Task 5)', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: /Adatforrások/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem/adatforrasok')
  })

  test('Detektorok tile navigates to the Detektorok page (Task 5)', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: /Detektorok/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem/detektorok')
  })

  test('an empty week (no runs) renders the tiles with no hero line — no fabricated line', () => {
    hoisted.runs = []
    renderHub()
    expect(screen.getByText('Gépterem')).toBeInTheDocument()
    expect(screen.getByText(/e héten 0 futás · 0 megfigyelés/)).toBeInTheDocument()
  })

  // M7 (final review): the Futások tile's "megfigyelés" sum used to fold in EVERY run kind's
  // observationCount, including MONTHLY's (which counts re-evaluated ÁLLÍTÁSOK, not
  // megfigyelések) — a MONTHLY row in the browsed week would silently inflate the "megfigyelés"
  // number with a claim count. The sum must stay restricted to NIGHTLY + WEEKLY.
  test('M7: the week tile\'s megfigyelés sum excludes MONTHLY/BOOTSTRAP counts (they aren\'t observations)', () => {
    hoisted.runs = [NIGHTLY_QUIET, NIGHTLY_SIGNAL, MONTHLY_RUN]
    renderHub()
    // NIGHTLY_QUIET(0) + NIGHTLY_SIGNAL(2) = 2 — MONTHLY_RUN's 23 must NOT be folded in.
    expect(screen.getByText(/e héten 3 futás · 2 megfigyelés/)).toBeInTheDocument()
  })
})
