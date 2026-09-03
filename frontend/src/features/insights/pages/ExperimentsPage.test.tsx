import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { ExperimentsPage } from '@/features/insights/pages/ExperimentsPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <ExperimentsPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('ExperimentsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the count, an active + a completed experiment, and the inert propose CTA', async () => {
    renderPage()
    // Prototype #page-kiserlet hero (mezo-d20.11): i-lombik + the count + the principle line.
    expect(screen.getByText('N=1 kísérletek')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.mz-bignum')?.textContent).toBe('2'))
    expect(screen.getByText('a saját testeden bizonyítjuk')).toBeInTheDocument()
    expect(screen.getByText('Glikogén-feltöltés volleyball előtt')).toBeInTheDocument()
    expect(screen.getByText('◐ Aktív')).toBeInTheDocument()
    expect(screen.getByText('✓ Megerősítve')).toBeInTheDocument()
    expect(screen.getByText('✓ Megerősítve · 3/4 mérés')).toBeInTheDocument()
    expect(screen.getByText('＋ Új kísérletet javasol Mezo')).toBeInTheDocument()
    // the mock seed has no proposed rows, so no accept/dismiss buttons appear (byte-parity)
    expect(screen.queryByRole('button', { name: 'Elfogadom' })).not.toBeInTheDocument()
  })

  test('status-washed tiles: active → amber + 7-day dot row + gold bar, confirmed → sage (mezo-d20.5.6)', () => {
    const { container } = renderPage()
    // active exp (4/7): amber wash, one dot per day, the elapsed ones filled
    const active = container.querySelector('.mzp-pred.amber')
    expect(active).not.toBeNull()
    const dots = active!.querySelectorAll('.mzp-daydots i')
    expect(dots).toHaveLength(7)
    expect(active!.querySelectorAll('.mzp-daydots i.f')).toHaveLength(4)
    const fill = active!.querySelector('.mzp-gbar div.gold') as HTMLElement
    expect(fill).not.toBeNull()
    expect(fill.style.width).toBe('57%') // round(4/7)
    // confirmed exp: sage wash, no dots, no bar — just the outcome line
    const sage = container.querySelector('.mzp-pred.sage')
    expect(sage).not.toBeNull()
    expect(sage!.querySelector('.mzp-daydots')).toBeNull()
    expect(sage!.querySelector('.mzp-gbar')).toBeNull()
    expect(container.querySelector('.mz-play')).not.toBeNull()
  })
})

describe('ExperimentsPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders a proposed experiment with L2 accept/dismiss; accepting posts and flips to ◐ Aktív 0/7', async () => {
    let accepted = false
    server.use(
      http.get(`${API_BASE}/api/proactive/experiment`, () =>
        HttpResponse.json([
          {
            id: 'e1',
            title: 'Esti magnézium',
            hypothesis: 'Korábbi adagolás → mélyebb alvás.',
            status: accepted ? 'active' : 'proposed',
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
        accepted = true
        return HttpResponse.json({
          id: params.id, title: 'Esti magnézium', hypothesis: 'x', status: 'active',
          metricKey: 'sleep_avg', expectedDirection: 'up', startDate: null, totalDays: 7,
          outcome: null, outcomeGood: null, generatedAt: '2026-07-07T06:45:00Z',
        })
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Elfogadom' }))
    await waitFor(() => expect(posted).toBe(true))
    // the accept mutation invalidates → the refetched row re-faces as the active amber tile
    expect(await screen.findByText('◐ Aktív')).toBeInTheDocument()
    expect(screen.getByText('0/7 nap')).toBeInTheDocument()
    expect(screen.queryByText('◇ Javaslat')).not.toBeInTheDocument()
  })

  test('renders the honest still-learning null-state on the default empty array', async () => {
    renderPage()
    expect(
      await screen.findByText('Az első N=1 kísérletet a megerősített mintákból javasolja Mezo.'),
    ).toBeInTheDocument()
    // no fabricated 0 in the hero — the empty branch renders no big number at all
    await waitFor(() => expect(document.querySelector('.mz-bignum')).toBeNull())
  })
})

// mezo-hq44: az „Elvetve" státusz-chip x-ikont kap; a ✓ Megerősítve marad glifa
// (házi pipa-idióma), ezért a fenti byte-parity elvárások érintetlenek.
describe('ExperimentsPage — emoji→ikon (mezo-hq44)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('a dismissed chip ikonos, a szöveg marad „Elvetve"', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/experiment`, () =>
        HttpResponse.json([
          {
            id: 'e9', title: 'Elvetett kísérlet', hypothesis: 'h', status: 'dismissed',
            metricKey: 'sleep_avg', expectedDirection: 'up', startDate: null, totalDays: 7,
            outcome: null, outcomeGood: null, generatedAt: '2026-07-07T06:45:00Z',
          },
        ]),
      ),
    )
    const { container } = renderPage()
    expect(await screen.findByText('Elvetett kísérlet')).toBeInTheDocument()
    const chip = container.querySelector('.mzp-stch.mut') as HTMLElement
    expect(chip).not.toBeNull()
    expect(chip.querySelector('svg')).toBeTruthy()
    expect(chip.textContent).not.toMatch(/✕/)
    expect(chip.textContent).toMatch(/Elvetve/)
  })
})
