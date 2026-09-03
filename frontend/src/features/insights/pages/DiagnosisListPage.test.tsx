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

  test('renders BOTH live ask cards, the upcoming catalog and the seeded report', () => {
    renderPage()
    expect(screen.getByText('Diagnózis')).toBeInTheDocument()
    // two live questions since mezo-po3y — the fatigue title also heads the seeded past tile
    expect(screen.getAllByText('Miért vagyok fáradt?').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Miért alszom rosszul?')).toBeInTheDocument()
    // generate is inert in mock — it costs a real SMART call — on EVERY live card
    const asks = screen.getAllByRole('button', { name: '✦ Kérdezd meg most' })
    expect(asks).toHaveLength(2)
    // the ask CTA is the house pill button, not an unstyled bare 'cta' (the live-app regression)
    asks.forEach((b) => expect(b).toHaveClass('mzp-cta'))
    asks.forEach((b) => expect(b).toBeDisabled())
    expect(screen.getByText('demo — a kérdezés az élő appban fut')).toBeInTheDocument()
    // the upcoming grid: sleep LEFT it by going live
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
    screen.getAllByRole('button', { name: '✦ Kérdezd meg most' }).forEach((b) => expect(b).toBeEnabled())
    expect(screen.getByText('napi 3 kérdés · a megnyitás mindig ingyen')).toBeInTheDocument()
  })
})
