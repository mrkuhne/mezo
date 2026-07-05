import { render, screen } from '@testing-library/react'
import { PredictionsPage } from '@/features/insights/pages/PredictionsPage'

describe('PredictionsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the header, pending + validated states, confidence and outcome', () => {
    render(<PredictionsPage />)
    expect(screen.getByText('Aktív predikciók')).toBeInTheDocument()
    expect(screen.getByText('2 validated · 60-day acc 68%')).toBeInTheDocument()
    expect(screen.getByText('Csütörtök Pull Day · Chest Row PR (107.5 × 8)')).toBeInTheDocument()
    expect(screen.getAllByText('◐ Pending').length).toBeGreaterThan(0)
    expect(screen.getByText('RPE 8.2 · vacsora 20:50')).toBeInTheDocument()
  })
})

describe('PredictionsPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the honest hamarosan ghost instead of the demo predictions', () => {
    render(<PredictionsPage />)
    expect(screen.getByText('hamarosan')).toBeInTheDocument()
    expect(screen.getByText('A predikciókat a minta-motor adja majd — a proaktív réteggel érkezik.')).toBeInTheDocument()
    expect(screen.queryByText('Aktív predikciók')).not.toBeInTheDocument()
  })
})
