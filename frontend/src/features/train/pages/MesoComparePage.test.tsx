import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MesoComparePage } from '@/features/train/pages/MesoComparePage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <div data-testid="loc">{`${pathname}${search}`}</div>
}

const renderAt = (query: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/mesocycles/compare${query}`]}>
        <Routes>
          <Route path="train/mesocycles/compare" element={<MesoComparePage />} />
          <Route path="train/mesocycles" element={<div>Mesociklusok</div>} />
          <Route path="train/mesocycles/:id/report" element={<div>Riport</div>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )

// Both mock fixture reports: meso-rec-03 (8 weeks, recovery block) vs meso-hyp-03
// (6 weeks, high-volume block).
const BOTH = '?a=meso-rec-03&b=meso-hyp-03'

describe('MesoComparePage (mock mode · the two fixture reports)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('heads both columns with the run title, window and length', () => {
    renderAt(BOTH)
    const head = screen.getByTestId('meso-compare-header')
    expect(within(head).getByText('Recovery rebuild · Tél')).toBeInTheDocument()
    expect(within(head).getByText('Hypertrophy 03 · Ősz')).toBeInTheDocument()
    expect(within(head).getByText('Feb 12 → Ápr 23')).toBeInTheDocument()
    expect(within(head).getByText('Okt 2 → Nov 13')).toBeInTheDocument()
    expect(within(head).getByText('8 hét')).toBeInTheDocument()
    expect(within(head).getByText('6 hét')).toBeInTheDocument()
  })

  it('puts the two adherence figures side by side', () => {
    renderAt(BOTH)
    const adh = screen.getByTestId('meso-compare-adherence')
    expect(within(adh).getByText('88%')).toBeInTheDocument()
    expect(within(adh).getByText('79%')).toBeInTheDocument()
    expect(within(adh).getByText('21/24 edzés')).toBeInTheDocument()
    expect(within(adh).getByText('19/24 edzés')).toBeInTheDocument()
  })

  it('tables each muscle\'s peak planned week against A\'s own MRV ceiling, "–" where a side never trained it', () => {
    renderAt(BOTH)
    const peak = screen.getByTestId('meso-compare-peak-volume')
    const rowFor = (label: string) => within(peak).getByText(label).closest('tr') as HTMLElement

    // chest: both runs trained it — A's own peak/ceiling next to B's peak
    const chestCells = within(rowFor('Mell')).getAllByRole('cell').map((c) => c.textContent)
    expect(chestCells[0]).toBe('Mell')
    expect(chestCells[1]).not.toBe('–') // A's peak planned week
    expect(chestCells[2]).not.toBe('–') // A's own MRV ceiling
    expect(chestCells[3]).not.toBe('–') // B's peak planned week

    // biceps exists ONLY in rec-03's (A's) arc — B's cell is an honest dash, never a 0
    const bicepCells = within(rowFor('Bicepsz')).getAllByRole('cell').map((c) => c.textContent)
    expect(bicepCells[3]).toBe('–')
  })

  it('shows each run\'s non-Grow focus tiers, and neither fixture run flagged legacy', () => {
    renderAt(BOTH)
    const focus = screen.getByTestId('meso-compare-focus')
    const rows = within(focus).getAllByTestId('focus-row')
    // Both mock fixture runs have no goalPreset at all (ABSENT, not present-and-wrong) and
    // both phase curves close on Deload — an absent preset alone is not legacy.
    expect(within(rows[0]).queryByTestId('focus-legacy-chip')).toBeNull()
    expect(within(rows[1]).queryByTestId('focus-legacy-chip')).toBeNull()
    // Neither fixture run carries musclePriorities either, so no tier chips at all — just
    // the side label and the (absent) legacy chip.
    expect(within(rows[0]).queryByTestId('focus-chip')).toBeNull()
    expect(within(rows[1]).queryByTestId('focus-chip')).toBeNull()
  })

  it('lists ONLY the shared exercises, loudest first, and highlights the better side', () => {
    renderAt(BOTH)
    const str = screen.getByTestId('meso-compare-strength')

    const rows = within(str).getAllByTestId('compare-strength-row')
    expect(rows.map((r) => within(r).getByTestId('compare-exercise').textContent)).toEqual([
      'Chest Supported Row', // 17,2% vs 11,5%
      'Lateral Raise', //      9,5% vs 14,5%
      'Leg Press', //          0% vs 12,5%
    ])
    // exercises unique to one run have nothing to compare -> absent
    expect(within(str).queryByText('Chin-up')).toBeNull()
    expect(within(str).queryByText('Barbell Bench Press')).toBeNull()

    // both runs' numbers on the row, LOAD and e1RM labelled apart
    const row = rows[0]
    expect(within(row).getByText('+12,5 kg')).toBeInTheDocument()
    expect(within(row).getByText('+17,2%')).toBeInTheDocument()
    expect(within(row).getByText('+7,5 kg')).toBeInTheDocument()
    expect(within(row).getByText('+11,5%')).toBeInTheDocument()
    // the better side is flagged for the reader (A won this lift, B won the next)
    expect(within(row).getByTestId('compare-better')).toHaveTextContent('+17,2%')
    expect(within(rows[1]).getByTestId('compare-better')).toHaveTextContent('+14,5%')
  })

  it('tables the context averages, with "–" where only one run measured', () => {
    renderAt(BOTH)
    const ctx = screen.getByTestId('meso-compare-context')
    const rowFor = (label: string) =>
      within(ctx).getByText(label).closest('tr') as HTMLElement

    expect(within(rowFor('Alvás')).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Alvás', '7,4 h', '6,8 h'])
    expect(within(rowFor('Súlyváltozás')).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Súlyváltozás', '-1,1 kg', '+1,4 kg'])
    // hyp-03 never aggregated an energy average — "–", not 0
    expect(within(rowFor('Energia')).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Energia', '6,5', '–'])
  })

  it('asks for two runs when the query params are missing or identical', async () => {
    const user = userEvent.setup()
    renderAt('')
    expect(screen.getByText(/Válassz két lezárt futamot/)).toBeInTheDocument()
    expect(screen.queryByTestId('meso-compare-header')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Történet megnyitása/ }))
    // exact, not toHaveTextContent: the compare path CONTAINS the library path
    expect(screen.getByTestId('loc').textContent).toBe('/train/mesocycles')
  })

  it('rejects a self-comparison (a === b)', () => {
    renderAt('?a=meso-rec-03&b=meso-rec-03')
    expect(screen.getByText(/Válassz két lezárt futamot/)).toBeInTheDocument()
    expect(screen.queryByTestId('meso-compare-header')).toBeNull()
  })

  it('sends the reader to generate the missing report when one side has none', async () => {
    const user = userEvent.setup()
    // meso-maint-01 is a PLANNED fixture run — no report exists for it
    renderAt('?a=meso-rec-03&b=meso-maint-01')

    expect(screen.getByText('Előbb generálj riportot')).toBeInTheDocument()
    // the ready side is not thrown away — the compare body simply waits
    expect(screen.queryByTestId('meso-compare-strength')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Riport megnyitása/ }))
    expect(screen.getByTestId('loc').textContent).toBe('/train/mesocycles/meso-maint-01/report')
  })

  it('walks back to the library from the breadcrumb', async () => {
    const user = userEvent.setup()
    renderAt(BOTH)
    await user.click(screen.getByRole('button', { name: /Vissza/ }))
    expect(screen.getByTestId('loc').textContent).toBe('/train/mesocycles')
  })
})

// Real-mode coverage for the legacy chip path (mesoCompare.focusDiff / isLegacyPlan): a run
// with a PRESENT, wrong goalPreset must still read as legacy — only an ABSENT preset is
// exempt (mock-mode's two fixture runs above cover that exemption; this covers the flag).
describe('MesoComparePage (real mode · one legacy run, one current)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  const mesoBase = {
    startDate: '2026-01-01', endDate: '2026-02-12', weeks: 6, currentWeek: 6,
    split: 'x', style: 'x', status: 'archived' as const,
  }
  const legacyMeso = {
    ...mesoBase,
    id: 'c0ffee00-0000-4000-8000-000000000001', title: 'Legacy blokk', shortTitle: 'Legacy',
    goal: 'x', goalPreset: 'strength', musclePriorities: { back: 'emphasize' },
    phaseCurve: ['MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload'],
  }
  const currentMeso = {
    ...mesoBase,
    id: 'c0ffee00-0000-4000-8000-000000000002', title: 'Current blokk', shortTitle: 'Current',
    goal: 'x', goalPreset: 'hypertrophy', musclePriorities: { chest: 'maintain' },
    phaseCurve: ['MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload'],
  }
  const reportFor = (meso: { id: string; title: string; startDate: string; endDate: string; weeks: number }) => ({
    mesocycleId: meso.id, templateId: null, title: meso.title,
    startDate: meso.startDate, endDate: meso.endDate, closedAt: '2026-02-12T18:00:00Z', weeks: meso.weeks,
    selfEval: null, aiEval: null, aiEvalStatus: 'ready', aiEvalGeneratedAt: null, aiEvalEnabled: false,
    adherence: { plannedSessions: 12, completedSessions: 10, plannedWeeks: 6, completedWeeks: 6, completionPct: 83 },
    volume: null, strength: [], records: { medalCount: 0, top: [] }, context: null,
  })

  it('flags the PRESENT-and-wrong-preset run legacy, leaves the current-preset run unflagged', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([legacyMeso, currentMeso])),
      http.get(`${API_BASE}/api/train/mesocycles/:id/report`, ({ params }) => {
        const meso = [legacyMeso, currentMeso].find((m) => m.id === params.id)
        return meso ? HttpResponse.json(reportFor(meso)) : new HttpResponse(null, { status: 404 })
      }),
    )
    render(
      <QueryWrapper>
        <MemoryRouter initialEntries={[`/train/mesocycles/compare?a=${legacyMeso.id}&b=${currentMeso.id}`]}>
          <Routes>
            <Route path="train/mesocycles/compare" element={<MesoComparePage />} />
          </Routes>
        </MemoryRouter>
      </QueryWrapper>,
    )

    const focus = await screen.findByTestId('meso-compare-focus')
    const rows = within(focus).getAllByTestId('focus-row')
    expect(within(rows[0]).getByTestId('focus-legacy-chip')).toHaveTextContent('régi modell · címke')
    expect(within(rows[0]).getByTestId('focus-chip')).toHaveTextContent('Hát ★')
    expect(within(rows[1]).queryByTestId('focus-legacy-chip')).toBeNull()
    expect(within(rows[1]).getByTestId('focus-chip')).toHaveTextContent('Mell')
  })
})
