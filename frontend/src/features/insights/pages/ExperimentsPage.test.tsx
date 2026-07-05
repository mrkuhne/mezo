import { render, screen } from '@testing-library/react'
import { ExperimentsPage } from '@/features/insights/pages/ExperimentsPage'

describe('ExperimentsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the count, an active + a completed experiment, and the propose CTA', () => {
    render(<ExperimentsPage />)
    expect(screen.getByText('N=1 kísérletek · 2')).toBeInTheDocument()
    expect(screen.getByText('Glikogén-feltöltés volleyball előtt')).toBeInTheDocument()
    expect(screen.getByText('◐ Aktív')).toBeInTheDocument()
    expect(screen.getByText('✓ Megerősítve')).toBeInTheDocument()
    expect(screen.getByText('Megerősítve · 3/4 mérés')).toBeInTheDocument()
    expect(screen.getByText('+ Új kísérlet javasol Mezo')).toBeInTheDocument()
  })
})

describe('ExperimentsPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the honest hamarosan ghost instead of the demo experiments', () => {
    render(<ExperimentsPage />)
    expect(screen.getByText('hamarosan')).toBeInTheDocument()
    expect(screen.getByText('Az N=1 kísérletek a proaktív réteggel érkeznek.')).toBeInTheDocument()
    expect(screen.queryByText('+ Új kísérlet javasol Mezo')).not.toBeInTheDocument()
  })
})
