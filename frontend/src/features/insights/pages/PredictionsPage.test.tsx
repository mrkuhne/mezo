import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { PredictionsPage } from '@/features/insights/pages/PredictionsPage'

const renderPage = () => render(<PredictionsPage />, { wrapper: QueryWrapper })

describe('PredictionsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the header, pending + validated states, confidence and outcome', () => {
    renderPage()
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

  test('renders real predictions with „tanulom" on null confidence and a derived accuracy header', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/prediction`, () =>
        HttpResponse.json([
          {
            id: 'p1',
            title: 'Hét 27 testsúly csökken',
            basis: 'Reta D3-D7 alacsonyabb intake.',
            confidence: null,
            metricKey: 'weight_trend',
            expectedDirection: 'down',
            validFrom: '2026-07-07',
            validTo: '2026-07-13',
            status: 'pending',
            generatedAt: '2026-07-07T06:30:00Z',
          },
          {
            id: 'p2',
            title: 'Alvás javul',
            basis: 'Korábbi lefekvés.',
            confidence: null,
            metricKey: 'sleep_avg',
            expectedDirection: 'up',
            validFrom: '2026-06-30',
            validTo: '2026-07-06',
            status: 'validated',
            actual: 'átlag 7.4 h vs 7.0 h (+0.4)',
            generatedAt: '2026-06-30T06:30:00Z',
          },
        ]),
      ),
    )
    renderPage()
    expect(await screen.findByText('Hét 27 testsúly csökken')).toBeInTheDocument()
    // null confidence renders the honest „tanulom" chip, not a fabricated %
    expect(screen.getAllByText('tanulom').length).toBeGreaterThan(0)
    // one validated of one closed row → derived header
    expect(screen.getByText('1 validated · acc 100%')).toBeInTheDocument()
    expect(screen.queryByText('hamarosan')).not.toBeInTheDocument()
    expect(screen.queryByText('2 validated · 60-day acc 68%')).not.toBeInTheDocument()
  })

  test('renders the honest still-learning null-state on the default empty array', async () => {
    renderPage()
    expect(
      await screen.findByText('Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Aktív predikciók')).not.toBeInTheDocument())
  })
})
