// Karakter hub — behavioural coverage (mezo-1gim.13), the WeekHubPage.test.tsx idiom: a single
// hook-override point on `@/data/hooks` makes this mode-AGNOSTIC (it passes identically under
// `pnpm test` and `VITE_USE_MOCK=false pnpm test` — both-mode commands still run it, but the
// hook contract itself, not this page, is what dual-mode data-layer tests pin).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { KarakterHubPage } from './KarakterHubPage'
import { QueryWrapper } from '@/test/queryWrapper'
import {
  MOCK_CONFERENCES,
  MOCK_EXPERTS,
  MOCK_FEED,
  MOCK_OVERVIEW,
  MOCK_OVERVIEW_EMPTY,
} from '@/data/character/characterMock'
import type { CharacterOverviewResponse, CharacterRunSummary } from '@/data/character/characterApi'
import type { CharacterBootstrapResult } from '@/data/character/characterHooks'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const hoisted = vi.hoisted(() => ({
  overview: null as unknown as import('@/data/character/characterApi').CharacterOverviewResponse | null,
  bootstrapPending: false,
  bootstrapResult: null as CharacterBootstrapResult | null,
  startSpy: vi.fn(),
  weekRuns: [] as CharacterRunSummary[],
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterOverview: () => ({ overview: hoisted.overview, isLoading: false }),
    useCharacterBootstrap: () => ({ start: hoisted.startSpy, pending: hoisted.bootstrapPending, result: hoisted.bootstrapResult }),
    useCharacterExperts: () => ({ experts: MOCK_EXPERTS, isLoading: false }),
    useCharacterFeed: () => ({ items: MOCK_FEED, isLoading: false }),
    useCharacterConferences: () => ({ conferences: MOCK_CONFERENCES, isLoading: false }),
    useCharacterRuns: () => ({ runs: hoisted.weekRuns, isLoading: false }),
  }
})

beforeEach(() => {
  hoisted.overview = MOCK_OVERVIEW
  hoisted.bootstrapPending = false
  hoisted.bootstrapResult = null
  hoisted.startSpy.mockReset()
  hoisted.weekRuns = []
  mockNavigate.mockReset()
})

const renderHub = () => render(<QueryWrapper><KarakterHubPage /></QueryWrapper>)

describe('KarakterHubPage', () => {
  test('renders the 4 hub tiles from the seeded dossier', () => {
    renderHub()
    expect(screen.getByRole('button', { name: 'Dimenziók' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Csapat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Konzílium' })).toBeInTheDocument()
  })

  test('the ring shows the aggregate CORE maturity', () => {
    renderHub()
    // (58+71+45+66+39+74+33)/7 = 55.14 -> 55, DIM_SEEDS order
    expect(screen.getByRole('img', { name: 'Karakter érettség: 55%' })).toBeInTheDocument()
  })

  test('the Csapat tile carries the 9-persona orb cluster', () => {
    const { container } = renderHub()
    const csapatTile = screen.getByRole('button', { name: 'Csapat' })
    expect(csapatTile.querySelectorAll('.kr-clustrow .cd')).toHaveLength(MOCK_EXPERTS.length)
    expect(container.querySelectorAll('.kr-clustrow .cd')).toHaveLength(9)
  })

  test('tiles navigate to their own full-page siblings', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: 'Dimenziók' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/dimenziok')
    await userEvent.click(screen.getByRole('button', { name: 'Feed' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/feed')
    await userEvent.click(screen.getByRole('button', { name: 'Csapat' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/csapat')
    await userEvent.click(screen.getByRole('button', { name: 'Konzílium' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/konzilium')
  })

  test('a pre-bootstrap empty dossier shows the intro ceremony face, not the mosaic', () => {
    hoisted.overview = MOCK_OVERVIEW_EMPTY
    renderHub()
    expect(screen.getByRole('button', { name: 'Kezdjétek el' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dimenziók' })).not.toBeInTheDocument()
  })

  test('Kezdjétek el starts the bootstrap ceremony', async () => {
    hoisted.overview = MOCK_OVERVIEW_EMPTY
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: 'Kezdjétek el' }))
    expect(hoisted.startSpy).toHaveBeenCalled()
  })

  test('bootstrap.pending shows the staggered-bootlines progress face', () => {
    hoisted.overview = MOCK_OVERVIEW_EMPTY
    hoisted.bootstrapPending = true
    renderHub()
    expect(screen.getByText('Doki a súlytrendet olvassa…')).toBeInTheDocument()
    expect(screen.getByText('Mezo összegzi a portrékat…')).toBeInTheDocument()
  })

  test("result 'created' shows the reveal face, then its CTA navigates to the first konzílium (Task 5 rewiring the prototype's own copy)", async () => {
    // The mutation already flipped the overview cache to the seeded dossier by the time
    // result === 'created' — the hook's documented contract.
    hoisted.overview = MOCK_OVERVIEW
    hoisted.bootstrapResult = 'created'
    renderHub()
    expect(screen.getByText('A dossziéd elkészült')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nézd meg az első konzíliumot' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/konzilium')
  })

  test("result 'empty' (204) shows the honest no-history face", () => {
    hoisted.overview = MOCK_OVERVIEW_EMPTY
    hoisted.bootstrapResult = 'empty'
    renderHub()
    expect(screen.getByText('Még nincs elég történet')).toBeInTheDocument()
  })

  // Fix round 1: the 204 face used to be a dead end (no in-page way back, matching the
  // prototype's own `#emptyBack` chip). `‹ vissza` resets the local ceremony state; since the
  // dossier itself is unchanged by a 204 (nothing was read), the honest landing is the SAME
  // intro face the page shows on any other untouched dossier — never re-trapped on the empty
  // face, never a crash.
  test("the 204 empty face's ‹ vissza returns to a sane state (the intro face, untouched dossier)", async () => {
    hoisted.overview = MOCK_OVERVIEW_EMPTY
    hoisted.bootstrapResult = 'empty'
    renderHub()
    expect(screen.getByText('Még nincs elég történet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '‹ vissza' }))
    expect(screen.queryByText('Még nincs elég történet')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kezdjétek el' })).toBeInTheDocument()
  })

  test("result 'conflict' falls through to the plain hub, even on a still-zero dossier", () => {
    hoisted.overview = MOCK_OVERVIEW_EMPTY
    hoisted.bootstrapResult = 'conflict'
    renderHub()
    expect(screen.getByRole('button', { name: 'Dimenziók' })).toBeInTheDocument()
  })

  test('the Gépterem row shows the last run\'s plain-language line and navigates on tap', async () => {
    hoisted.weekRuns = [{
      id: 'ejsz-30', kind: 'NIGHTLY', day: '2026-08-30', observationCount: 3, callCount: 2,
      detectorKeys: ['journal-note'], expertKeys: ['pszichologus', 'taplalkozo'], conferenceId: null,
    }]
    renderHub()
    // Fix round 1 (a11y): no `aria-label` overrides this button's name any more — the
    // accessible name is its own text content, which includes the live last-run line, so a
    // name query has to match on that too (not just the bare eyebrow word "Gépterem").
    const row = screen.getByRole('button', { name: /Gépterem.*3 megfigyelés · 2 szakértő hívva/ })
    expect(row).toBeInTheDocument()
    expect(screen.getByText(/3 megfigyelés · 2 szakértő hívva/)).toBeInTheDocument()
    await userEvent.click(row)
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem')
  })

  test('an empty week (no runs yet) renders the Gépterem row with its static tagline, never a fabricated line', () => {
    hoisted.weekRuns = []
    renderHub()
    // The deliberate empty-state fallback (coordinator decision, fix round 1) — a plain
    // tagline, not a blank row, and never a fabricated count.
    const row = screen.getByRole('button', { name: /Gépterem.*mi táplálja a dossziét — nyíltan/ })
    expect(row).toBeInTheDocument()
    expect(screen.getByText('mi táplálja a dossziét — nyíltan')).toBeInTheDocument()
  })

  test('overview null (character switch off) renders the degraded row, never a crash', () => {
    hoisted.overview = null as unknown as CharacterOverviewResponse
    renderHub()
    expect(screen.getByText(/jelenleg nem elérhető/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dimenziók' })).not.toBeInTheDocument()
  })
})
