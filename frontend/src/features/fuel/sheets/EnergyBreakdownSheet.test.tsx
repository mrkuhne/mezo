import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { EnergyBreakdownSheet, type EnergyBreakdown } from '@/features/fuel/sheets/EnergyBreakdownSheet'

const fuelBreakdown: EnergyBreakdown = {
  base: { kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' },
  movement: {
    kcal: 1290,
    isWeeklyAvg: false,
    pending: 460,
    parts: [
      { key: 'planned', label: 'Tervezett edzés · logolva', kcal: 900 },
      { key: 'extra', label: 'Terven kívüli mozgás', kcal: 390 },
    ],
    blocks: [
      { label: 'Gym', kind: 'gym', min: 60, kcal: 430, done: true },
      { label: 'Röplabda', kind: 'sport', min: 90, kcal: 860, done: false },
    ],
  },
  deficit: { kcal: -869, rateKgPerWk: 0.79, goalLabel: 'Nyári cut' },
  target: 2693,
}

const learnedBreakdown: EnergyBreakdown = {
  ...fuelBreakdown,
  base: { ...fuelBreakdown.base, source: 'learned', formulaKcal: 2880, sdKcal: 140, confidence: 'medium' },
}

// The learned path links out to the „Hogy tanultam?” page, so the sheet renders inside a router.
const Router = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>

const profileBreakdown: EnergyBreakdown = {
  base: { kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' },
  movement: { kcal: 1207, isWeeklyAvg: true },
  target: 3479,
}

describe('EnergyBreakdownSheet', () => {
  it('renders all three sections and per-activity pills when deficit + blocks present', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText('Alaphő · NEAT')).toBeInTheDocument()
    expect([...document.body.querySelectorAll('.flp-estit')].map(e => e.textContent)).toContain('Mozgás · ma logolva')
    expect(screen.getByText(/Deficit · Nyári cut/)).toBeInTheDocument()
    // per-activity tiles (organized: name + duration + kcal) — Gym is done, Röplabda still pending
    expect(screen.getByText('Gym')).toBeInTheDocument()
    expect(screen.getByText('Röplabda')).toBeInTheDocument()
    expect(screen.getByText('60 perc')).toBeInTheDocument()
    // equation-bar total (plain number, no thousands grouping)
    expect(screen.getByText('2693')).toBeInTheDocument()
  })

  it('the Fuel movement row closes: its summand tiles are the served parts, previews carry no operators (mezo-32m82)', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    const sum = document.body.querySelector('.flp-eblk.is-hl .flp-etiles:not(.is-info)')!
    const summands = [...sum.querySelectorAll('.flp-etile:not(.is-result) .flp-etile-val')].map(v => Number.parseInt(v.textContent!, 10))
    expect(summands).toEqual(fuelBreakdown.movement.parts!.map(p => p.kcal))
    expect(summands.reduce((a, n) => a + n, 0)).toBe(fuelBreakdown.movement.kcal)
    const infoGroups = [...document.body.querySelectorAll('.flp-etiles.is-info')]
    const infoTileCount = infoGroups.reduce((n, g) => n + g.querySelectorAll('.flp-etile').length, 0)
    expect(infoTileCount).toBe(fuelBreakdown.movement.blocks!.length)
    expect(infoGroups.every(g => g.querySelector('.op') === null)).toBe(true)
    expect(screen.queryByText(/pihenőnapon 0/)).not.toBeInTheDocument()
    expect(screen.getByText(/akkor nő, amikor rögzíted/)).toBeInTheDocument()
  })

  it('the lead reads the fixed „ma logolt mozgásod” sentence on the Fuel (non-weekly) path', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    expect(
      screen.getByText('A napi cél nem statikus — az alapigényedből, a ma logolt mozgásodból és a célodból áll össze.'),
    ).toBeInTheDocument()
  })

  it('previews the not-yet-logged planned sessions under „Még jön” when pending > 0', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText('Még jön, ha megcsinálod · a keretben még nincs benne')).toBeInTheDocument()
    const pendingTile = screen.getByText('Röplabda').closest('.flp-etile')!
    expect(pendingTile).toHaveClass('is-pending')
    expect(pendingTile.textContent).toContain('tervezett · 90 perc')
    expect(pendingTile.textContent).toContain('+860')
  })

  it('hides the „Még jön” group when nothing is pending', () => {
    const noPending: EnergyBreakdown = { ...fuelBreakdown, movement: { ...fuelBreakdown.movement, pending: 0 } }
    render(<EnergyBreakdownSheet breakdown={noPending} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.queryByText(/Még jön/)).not.toBeInTheDocument()
  })

  it('hides the „Még jön” group when pending > 0 but every block is done by the FE rule (mezo-tb3s2)', () => {
    // e.g. a non-meso gym workout: gymDoneDates marks the block done while the backend keeps it pending.
    const allDone: EnergyBreakdown = {
      ...fuelBreakdown,
      movement: { ...fuelBreakdown.movement, blocks: fuelBreakdown.movement.blocks!.map(b => ({ ...b, done: true })) },
    }
    render(<EnergyBreakdownSheet breakdown={allDone} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.queryByText(/Még jön/)).not.toBeInTheDocument()
    expect(document.querySelector('.flp-etile.is-pending')).toBeNull()
  })

  it('omits the deficit section and shows a weekly-avg movement (no pills) when deficit absent', () => {
    render(<EnergyBreakdownSheet breakdown={profileBreakdown} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText('Alaphő · NEAT')).toBeInTheDocument()
    expect(screen.queryByText(/Deficit/)).not.toBeInTheDocument()
    expect(screen.queryByText('Gym')).not.toBeInTheDocument()
    expect(screen.getByText(/heti átlag/i)).toBeInTheDocument()
    // Net-model copy (mezo-32m82): no stale gross-MET / "pihenőnapon 0" wording.
    expect(screen.getByText(/nyugalmi energiád feletti többlet/)).toBeInTheDocument()
    expect(screen.queryByText(/MET-alapú/)).not.toBeInTheDocument()
  })

  it('the base section title reads "Alap · tanult" on the learned path, not the formula "Alaphő · NEAT" (mezo-zz91i)', () => {
    render(<EnergyBreakdownSheet breakdown={learnedBreakdown} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText('Alap · tanult')).toBeInTheDocument()
    expect(screen.queryByText('Alaphő · NEAT')).not.toBeInTheDocument()
  })

  it('renders the learned-base confidence line + formula tile joined by an arrow, no ×/= (mezo-zz91i)', () => {
    render(<EnergyBreakdownSheet breakdown={learnedBreakdown} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText(/Tanult alap · Közepesen biztos · ±140 kcal/)).toBeInTheDocument()
    expect(screen.getByText('Képlet szerint')).toBeInTheDocument()
    expect(screen.getByText('BMR × NEAT')).toBeInTheDocument()
    expect(screen.getByText('2880')).toBeInTheDocument()
    expect(screen.getByText('Tanult alap')).toBeInTheDocument()
    const tiles = document.body.querySelector('.flp-eblk.is-hl .flp-etiles')!
    expect(tiles.querySelector('.op')?.textContent).toBe('→')
    expect([...tiles.querySelectorAll('.op')].map(o => o.textContent)).not.toContain('×')
    expect([...tiles.querySelectorAll('.op')].map(o => o.textContent)).not.toContain('=')
    // The false equation (BMR × formula = learned) is gone — no separate "Alapanyagcsere" tile.
    expect(screen.queryByText('Alapanyagcsere')).not.toBeInTheDocument()
  })

  it('omits confidence/sd parts of the line when missing, with no fabricated defaults (mezo-zz91i)', () => {
    const noConfidence: EnergyBreakdown = {
      ...fuelBreakdown,
      base: { ...fuelBreakdown.base, source: 'learned', formulaKcal: 2880, sdKcal: null, confidence: null },
    }
    render(<EnergyBreakdownSheet breakdown={noConfidence} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getAllByText('Tanult alap').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Közepesen biztos/)).not.toBeInTheDocument()
    expect(screen.queryByText(/±/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Még tanulok/)).not.toBeInTheDocument()
  })

  it('omits the formula tile and arrow (no "0") when formulaKcal is missing (mezo-zz91i)', () => {
    const noFormula: EnergyBreakdown = {
      ...fuelBreakdown,
      base: { ...fuelBreakdown.base, source: 'learned', sdKcal: 140, confidence: 'medium' },
    }
    render(<EnergyBreakdownSheet breakdown={noFormula} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.queryByText('Képlet szerint')).not.toBeInTheDocument()
    const tiles = document.body.querySelector('.flp-eblk.is-hl .flp-etiles')!
    expect(tiles.querySelector('.op')).toBeNull()
    expect(screen.queryByText(/A képlet .* kcal-t mondana/)).not.toBeInTheDocument()
  })

  it('the learned Alap block ends in one summary line with „Részletek ›” to the learning page, no inline explainer (mezo-3n2so)', async () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter initialEntries={['/fuel']}>
        <Routes>
          <Route path="/fuel" element={<EnergyBreakdownSheet breakdown={learnedBreakdown} initial="base" onClose={onClose} />} />
          <Route path="/fuel/tanulas" element={<p>tanulás oldal</p>} />
        </Routes>
      </MemoryRouter>,
    )
    const link = screen.getByRole('button', { name: /Tanult alap · Közepesen biztos · ±140 kcal.*Részletek ›/ })
    expect(link).toHaveTextContent('Hogy tanultam? — hétről hétre, és a napjaid')
    // the old in-sheet expander is gone — the six sections live on the page now
    expect(screen.queryByRole('button', { expanded: false })).toBeNull()
    expect(document.querySelector('.flp-how')).toBeNull()
    await userEvent.click(link)
    expect(onClose).toHaveBeenCalled()
    expect(screen.getByText('tanulás oldal')).toBeInTheDocument()
  })

  it('the formula path keeps „Képlet alapján” and has no link to the learning page (mezo-3n2so)', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.queryByRole('button', { name: /Részletek/ })).toBeNull()
  })

  it('renders "Képlet alapján" and keeps the BMR × NEAT tiles unchanged for the formula base path', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText('Képlet alapján')).toBeInTheDocument()
    expect(screen.getByText('NEAT-szorzó')).toBeInTheDocument()
    expect(screen.queryByText(/Tanult alap/)).not.toBeInTheDocument()
  })

  it('highlights the initial section', () => {
    // Sheet renders into a portal (document.body), not the render container.
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="deficit" onClose={vi.fn()} />, { wrapper: Router })
    const hl = document.body.querySelector('.flp-eblk.is-hl')
    expect(hl?.textContent).toMatch(/Deficit/)
  })
})
