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

// Folyadék (mezo-n4wf5.5): one vessel of the parts with the sum under it, then a section per part — a label, a small
// equation of tiles (`.ft-eq3`, the result on the liquid) and its sentence. Numbers are grouped („2 693").
const sheet = () => screen.getByRole('dialog')
const seg = (label: RegExp) => screen.getByText(label).closest('.ft-seg') as HTMLElement
const eq = (el: HTMLElement) => [...el.querySelector('.ft-eq3')!.children].map(c => c.textContent)

describe('EnergyBreakdownSheet', () => {
  it('head, the vessel of the parts and the sum that closes on the target', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    expect(sheet()).toHaveClass('fo-sheet')
    expect(screen.getByRole('heading', { name: 'Honnan jön a 2 693 kcal?' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Alap 2 272 kcal, mozgás 1 290 kcal, a mai cél 2 693 kcal' })).toBeInTheDocument()
    expect([...document.querySelectorAll('.fx-leg > span')].map(x => x.textContent)).toEqual(['Alap2 272', 'Mozgás+1 290', 'Deficit−869'])
    expect(document.querySelector('.ft-sum')!.textContent).toBe('2 272 + 1 290 − 869= 2 693')
    // the old skin is gone
    expect(document.querySelector('.flp-eh, .flp-eq, .flp-eblk, .flp-etile, .uv-eyebrow, .glass')).toBeNull()
  })

  it('renders all three sections and the per-activity lines when deficit + blocks present', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText('Alap · képlet szerint · 2 272')).toBeInTheDocument()
    expect(screen.getByText('Mozgás · ma logolva · +1 290')).toBeInTheDocument()
    expect(screen.getByText('Deficit · Nyári cut · −869')).toBeInTheDocument()
    // per-activity lines (name · duration → kcal) — Gym is done, Röplabda still pending
    expect(screen.getByText('Gym · 60 perc').nextSibling?.textContent).toBe('430 kcal')
    expect(screen.getByText('Röplabda · tervezett · 90 perc')).toBeInTheDocument()
    expect(eq(seg(/^Deficit · Nyári cut/))).toEqual(['0,79Cél ütem · kg/hét', '→', '−869Napi deficit'])
    expect(screen.getByText(/A „Nyári cut” célod kb\. 0,79 kg\/hét üteméhez napi kb\. 869 kcal deficit tartozik \(kb\. 7 700 kcal \/ 1 kg zsír/)).toBeInTheDocument()
  })

  it('a stored rationale replaces the default deficit sentence, word for word', () => {
    const withWhy: EnergyBreakdown = { ...fuelBreakdown, deficit: { ...fuelBreakdown.deficit!, rationale: 'A tárolt indoklás.' } }
    render(<EnergyBreakdownSheet breakdown={withWhy} initial="deficit" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText('A tárolt indoklás.')).toBeInTheDocument()
    expect(screen.queryByText(/7 700 kcal/)).not.toBeInTheDocument()
  })

  it('the Fuel movement row closes: its summand tiles are the served parts, previews carry no operators (mezo-32m82)', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    const move = seg(/^Mozgás · ma logolva/)
    expect(eq(move)).toEqual(['900Tervezett edzés · logolva', '+', '390Terven kívüli mozgás', '=', '+1 290Mai mozgás'])
    const summands = [...move.querySelectorAll('.ft-eq3 > span:not(.res) > b')].map(v => Number.parseInt(v.textContent!, 10))
    expect(summands).toEqual(fuelBreakdown.movement.parts!.map(p => p.kcal))
    expect(summands.reduce((a, n) => a + n, 0)).toBe(fuelBreakdown.movement.kcal)
    const info = [...move.querySelectorAll('.ft-info')]
    expect(info.reduce((n, g) => n + g.querySelectorAll('.fx-kv > div').length, 0)).toBe(fuelBreakdown.movement.blocks!.length)
    expect(info.every(g => g.querySelector('.ft-eq3') === null)).toBe(true)
    expect(screen.queryByText(/pihenőnapon 0/)).not.toBeInTheDocument()
    expect(screen.getByText(/akkor nő, amikor rögzíted/)).toBeInTheDocument()
  })

  it('the lead reads the fixed „ma logolt mozgásod” sentence on the Fuel (non-weekly) path', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    expect(
      screen.getByText('A napi cél nem statikus: az alapigényedből, a ma logolt mozgásodból és a célodból áll össze.'),
    ).toBeInTheDocument()
  })

  it('previews the not-yet-logged planned sessions under „Még jön” when pending > 0', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    const pending = screen.getByText('Még jön, ha megcsinálod · a keretben még nincs benne').closest('.ft-info')!
    expect(pending).toHaveClass('pending')
    expect(pending.textContent).toContain('Röplabda · tervezett · 90 perc')
    expect(pending.textContent).toContain('+860 kcal')
    expect(pending.textContent).not.toContain('Gym')
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
    expect(document.querySelector('.ft-info.pending')).toBeNull()
  })

  it('omits the deficit section and shows a weekly-avg movement (no per-activity lines) when deficit absent', () => {
    render(<EnergyBreakdownSheet breakdown={profileBreakdown} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText('Alap · képlet szerint · 2 272')).toBeInTheDocument()
    expect(screen.queryByText(/Deficit/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Gym/)).not.toBeInTheDocument()
    expect(screen.getByText('A napi cél nem statikus: az alapanyagcserédből és a heti betáblázott mozgásból áll össze.')).toBeInTheDocument()
    expect(eq(seg(/^Betáblázott mozgás · \+1 207/))).toEqual(['+1 207Heti átlag · betáblázott ÷ 7'])
    expect(document.querySelector('.ft-sum')!.textContent).toBe('2 272 + 1 207= 3 479')
    // Net-model copy (mezo-32m82): no stale gross-MET / "pihenőnapon 0" wording.
    expect(screen.getByText(/nyugalmi energiád feletti többlet/)).toBeInTheDocument()
    expect(screen.queryByText(/MET-alapú/)).not.toBeInTheDocument()
  })

  it('the weekly-average path takes the opener\'s own section title', () => {
    const own: EnergyBreakdown = { ...profileBreakdown, movement: { ...profileBreakdown.movement, label: 'Heti edzésterv' } }
    render(<EnergyBreakdownSheet breakdown={own} initial="movement" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText('Heti edzésterv · +1 207')).toBeInTheDocument()
  })

  it('the base section title reads "Alap · tanult" on the learned path, not the formula one (mezo-zz91i)', () => {
    render(<EnergyBreakdownSheet breakdown={learnedBreakdown} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText('Alap · tanult · 2 272')).toBeInTheDocument()
    expect(screen.queryByText(/Alap · képlet szerint/)).not.toBeInTheDocument()
  })

  it('renders the learned-base confidence row + the formula tile joined by an arrow, no ×/= (mezo-zz91i)', () => {
    render(<EnergyBreakdownSheet breakdown={learnedBreakdown} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getByText('Tanult alap · Közepesen biztos · ±140 kcal')).toBeInTheDocument()
    expect(eq(seg(/^Alap · tanult/))).toEqual(['2 880Képlet szerint · alapanyagcsere × életmód', '→', '2 272Tanult alap'])
    expect(screen.getByText('edzés nélkül').tagName).toBe('B')
    expect(screen.getByText(/A képlet 2 880 kcal-t mondana\./)).toBeInTheDocument()
    // The false equation (BMR × formula = learned) is gone — no separate "Alapanyagcsere" tile.
    expect(screen.queryByText(/^Alapanyagcsere ·/)).not.toBeInTheDocument()
    // the retired jargon stays out
    expect(screen.queryByText(/BMR|NEAT|Alaphő/)).not.toBeInTheDocument()
  })

  it('omits confidence/sd parts of the row when missing, with no fabricated defaults (mezo-zz91i)', () => {
    const noConfidence: EnergyBreakdown = {
      ...fuelBreakdown,
      base: { ...fuelBreakdown.base, source: 'learned', formulaKcal: 2880, sdKcal: null, confidence: null },
    }
    render(<EnergyBreakdownSheet breakdown={noConfidence} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(screen.getAllByText('Tanult alap').length).toBe(2) // the result tile and the row
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
    expect(screen.queryByText(/Képlet szerint/)).not.toBeInTheDocument()
    expect(eq(seg(/^Alap · tanult/))).toEqual(['2 272Tanult alap'])
    expect(screen.queryByText(/A képlet .* kcal-t mondana/)).not.toBeInTheDocument()
  })

  it('the learned Alap section ends in one row to the learning page, no inline explainer (mezo-3n2so)', async () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter initialEntries={['/fuel']}>
        <Routes>
          <Route path="/fuel" element={<EnergyBreakdownSheet breakdown={learnedBreakdown} initial="base" onClose={onClose} />} />
          <Route path="/fuel/tanulas" element={<p>tanulás oldal</p>} />
        </Routes>
      </MemoryRouter>,
    )
    const link = screen.getByRole('button', { name: /Tanult alap · Közepesen biztos · ±140 kcal/ })
    expect(link).toHaveTextContent('Hogy tanultam? Hétről hétre, és a napjaid')
    // the six steps live on the page
    expect(screen.queryByRole('button', { expanded: false })).toBeNull()
    expect(document.querySelector('.ft-step')).toBeNull()
    await userEvent.click(link)
    expect(onClose).toHaveBeenCalled()
    expect(screen.getByText('tanulás oldal')).toBeInTheDocument()
  })

  it('the formula path has no row to the learning page (mezo-3n2so)', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(document.querySelector('.ft-learned')).toBeNull()
    expect(screen.queryByText(/Hogy tanultam/)).toBeNull()
  })

  it('the formula base path: resting burn × lifestyle factor = base, in the new words', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="base" onClose={vi.fn()} />, { wrapper: Router })
    expect(eq(seg(/^Alap · képlet szerint/))).toEqual(['1 893Alapanyagcsere · Katch-McArdle', '×', '1,20Életmód-szorzó · Ülő', '=', '2 272Alap'])
    expect(screen.getByText('életmód-szorzóddal').tagName).toBe('B')
    expect(screen.queryByText(/Tanult alap/)).not.toBeInTheDocument()
    expect(screen.queryByText(/BMR|NEAT|Alaphő/)).not.toBeInTheDocument()
  })

  it('marks the initial section', () => {
    // Sheet renders into a portal (document.body), not the render container.
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="deficit" onClose={vi.fn()} />, { wrapper: Router })
    const on = document.body.querySelectorAll('.ft-seg.on')
    expect(on).toHaveLength(1)
    expect(on[0].textContent).toMatch(/Deficit/)
  })

  it('„Bezárom" closes the sheet', async () => {
    const onClose = vi.fn()
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="base" onClose={onClose} />, { wrapper: Router })
    await userEvent.click(screen.getByRole('button', { name: 'Bezárom' }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
