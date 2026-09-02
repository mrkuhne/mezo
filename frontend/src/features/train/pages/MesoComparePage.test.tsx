import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MesoComparePage } from '@/features/train/pages/MesoComparePage'
import { QueryWrapper } from '@/test/queryWrapper'

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

  it('shows each run\'s non-Grow focus tiers, Emphasize starred, a legacy run flagged', () => {
    renderAt(BOTH)
    const focus = screen.getByTestId('meso-compare-focus')
    const rows = within(focus).getAllByTestId('focus-row')
    // Both mock fixture runs predate the wizard v2 goalPreset stamp — both read as legacy.
    expect(within(rows[0]).getByTestId('focus-legacy-chip')).toHaveTextContent('régi modell · címke')
    expect(within(rows[1]).getByTestId('focus-legacy-chip')).toHaveTextContent('régi modell · címke')
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
