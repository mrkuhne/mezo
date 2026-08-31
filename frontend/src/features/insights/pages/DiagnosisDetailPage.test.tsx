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
