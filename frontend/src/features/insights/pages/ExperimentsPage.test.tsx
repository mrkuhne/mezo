import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { ExperimentsPage } from '@/features/insights/pages/ExperimentsPage'

const renderPage = () => render(<ExperimentsPage />, { wrapper: QueryWrapper })

describe('ExperimentsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the count, an active + a completed experiment, and the inert propose CTA', () => {
    renderPage()
    expect(screen.getByText('N=1 kísérletek · 2')).toBeInTheDocument()
    expect(screen.getByText('Glikogén-feltöltés volleyball előtt')).toBeInTheDocument()
    expect(screen.getByText('◐ Aktív')).toBeInTheDocument()
    expect(screen.getByText('✓ Megerősítve')).toBeInTheDocument()
    expect(screen.getByText('Megerősítve · 3/4 mérés')).toBeInTheDocument()
    expect(screen.getByText('+ Új kísérlet javasol Mezo')).toBeInTheDocument()
    // the mock seed has no proposed rows, so no accept/dismiss buttons appear (byte-parity)
    expect(screen.queryByRole('button', { name: 'Elfogadom' })).not.toBeInTheDocument()
  })
})

describe('ExperimentsPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders a proposed experiment with L2 accept/dismiss; accepting posts the decision', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/experiment`, () =>
        HttpResponse.json([
          {
            id: 'e1',
            title: 'Esti magnézium',
            hypothesis: 'Korábbi adagolás → mélyebb alvás.',
            status: 'proposed',
            metricKey: 'sleep_avg',
            expectedDirection: 'up',
            startDate: null,
            totalDays: 7,
            outcome: null,
            outcomeGood: null,
            generatedAt: '2026-07-07T06:45:00Z',
          },
        ]),
      ),
    )
    renderPage()
    expect(await screen.findByText('Esti magnézium')).toBeInTheDocument()
    expect(screen.getByText('◇ Javaslat')).toBeInTheDocument()
    expect(screen.queryByText('hamarosan')).not.toBeInTheDocument()

    let posted = false
    server.use(
      http.post(`${API_BASE}/api/proactive/experiment/:id/decision`, async ({ params }) => {
        posted = true
        return HttpResponse.json({
          id: params.id, title: 'Esti magnézium', hypothesis: 'x', status: 'active',
          metricKey: 'sleep_avg', expectedDirection: 'up', startDate: '2026-07-07', totalDays: 7,
          outcome: null, outcomeGood: null, generatedAt: '2026-07-07T06:45:00Z',
        })
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Elfogadom' }))
    await waitFor(() => expect(posted).toBe(true))
  })

  test('renders the honest still-learning null-state on the default empty array', async () => {
    renderPage()
    expect(
      await screen.findByText('Az első N=1 kísérletet a megerősített mintákból javasolja Mezo.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('N=1 kísérletek · 0')).not.toBeInTheDocument())
  })
})
