import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { DiagnosisListPage } from '@/features/insights/pages/DiagnosisListPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <DiagnosisListPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('DiagnosisListPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the ask card, the upcoming catalog and the seeded report', () => {
    renderPage()
    expect(screen.getByText('Diagnózis')).toBeInTheDocument()
    expect(screen.getByText('Miért vagyok fáradt?')).toBeInTheDocument()
    // generate is inert in mock — it costs a real SMART call
    expect(screen.getByRole('button', { name: '✦ Kérdezd meg most' })).toBeDisabled()
    expect(screen.getByText('demo — a kérdezés az élő appban fut')).toBeInTheDocument()
    // the catalog grid (round 2): upcoming questions, dashed
    expect(screen.getByText('Miért nem mozdul a súlyom?')).toBeInTheDocument()
    expect(screen.getByText('Havi Mezo Riport')).toBeInTheDocument()
    // the seeded past report with its strongest suspect
    expect(screen.getByText(/a legerősebb: Alváshiány \(erős\)/)).toBeInTheDocument()
  })
})

describe('DiagnosisListPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest empty state — never the mock seed', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('Még nem kérdezted meg. A Mezo az elmúlt két hét adataiból keres okokat.')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/Alváshiány/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '✦ Kérdezd meg most' })).toBeEnabled()
    expect(screen.getByText('napi 3 kérdés · a megnyitás mindig ingyen')).toBeInTheDocument()
  })
})
