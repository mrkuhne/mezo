import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { mockDiagnoses } from '@/data/insights/diagnosisMock'
import { DiagnosisDetailPage } from '@/features/insights/pages/DiagnosisDetailPage'

const renderAt = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/mezo/diagnozis/${id}`]}>
      <Routes>
        <Route path="/mezo/diagnozis/:id" element={<DiagnosisDetailPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('DiagnosisDetailPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders verdict, ranked suspects with index-resolved evidence, and the probe blocks', () => {
    renderAt(mockDiagnoses[0].id)
    expect(screen.getByText('Miért vagyok fáradt?')).toBeInTheDocument()
    expect(screen.getByText('◆ mérsékelt bizonyosság')).toBeInTheDocument()
    expect(screen.getByText(/az alvás megrövidülése/)).toBeInTheDocument()
    // rank badges + titles
    expect(screen.getByText('Alváshiány')).toBeInTheDocument()
    expect(screen.getByText('Megugrott terhelés')).toBeInTheDocument()
    // evidence resolved THROUGH evidenceIndexes: suspect 1 cites the sleep metric with provenance
    expect(screen.getAllByText('alváshossz').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Alvás-napló · 13 nap/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('↓ 1,2').length).toBeGreaterThan(0)
    // probe blocks carry their length + text
    expect(screen.getAllByText(/Próba · 7 nap/).length).toBe(2)
    expect(screen.getByText('Feküdj le hét estén át 23:00 előtt, és nézzük meg újra.')).toBeInTheDocument()
    // the probe CTA is live-only
    screen.getAllByRole('button', { name: '✓ Próbáljuk ki' }).forEach((b) => {
      expect(b).toBeDisabled()
      expect(b).toHaveClass('mzp-cta')
    })
  })

  test('an unknown id renders the honest not-found card', () => {
    renderAt('no-such-id')
    expect(screen.getByText('Ez a riport nincs meg — lehet, hogy törölted.')).toBeInTheDocument()
  })
})

// mezo-85x5r: the anchored weight row — Számvetés card above the verdict, derived rows
// excluded from the suspects' own evidence rows (they stay indexable, just not re-rendered).
describe('DiagnosisDetailPage — Számvetés (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  const weightDiag = mockDiagnoses.find((d) => d.phenomenon === 'weight')!

  test('renders the Számvetés card with all 4 derived rows above the verdict card', () => {
    const { container } = renderAt(weightDiag.id)
    expect(screen.getByText('SZÁMVETÉS')).toBeInTheDocument()
    expect(screen.getByText('valódi delta')).toBeInTheDocument()
    expect(screen.getByText('szövet-plafon')).toBeInTheDocument()
    expect(screen.getByText('cél-sáv')).toBeInTheDocument()
    expect(screen.getByText('erő-trend')).toBeInTheDocument()
    expect(screen.getAllByText(/heti átlag 82,4/).length).toBeGreaterThan(0)

    // above the verdict card in DOM order
    const cards = container.querySelectorAll('.mzp-pred')
    const szamvetesCard = screen.getByText('SZÁMVETÉS').closest('.mzp-pred')
    expect(cards[0]).toBe(szamvetesCard)

    // house classes only
    expect(container.querySelectorAll('.mzp-evrow').length).toBeGreaterThanOrEqual(4)
  })

  test('a suspect citing a derived index does not re-render it inside its own evidence rows', () => {
    renderAt(weightDiag.id)
    // 'szövet-plafon' is cited by suspect rank 1 (evidenceIndexes [1, 5]) but must render
    // exactly once — inside the Számvetés card, never duplicated in the suspect's own rows
    expect(screen.getAllByText('szövet-plafon')).toHaveLength(1)
    // the suspect's OWN (non-derived) metric evidence still renders normally
    expect(screen.getByText('nátrium')).toBeInTheDocument()
  })

  test('the hero sub is the anchored week range, with no separately-derived mérés count', () => {
    renderAt(weightDiag.id)
    expect(screen.getByText('Aug 31–Szep 6')).toBeInTheDocument()
  })

  // mezo-85x5r final-review wave: the mérés count renders ONCE, honestly, on the backend-computed
  // 'valódi delta' Számvetés row — not duplicated (and not mismatched) on the hero sub.
  test('the mérés count renders on the valódi delta Számvetés row', () => {
    renderAt(weightDiag.id)
    expect(screen.getAllByText(/heti átlag 82,4.*5 mérés/).length).toBeGreaterThan(0)
  })
})
