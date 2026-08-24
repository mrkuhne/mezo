import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { WeeklyPage } from '@/features/insights/pages/WeeklyPage'

const renderPage = () => render(<WeeklyPage />, { wrapper: QueryWrapper })

const FEEDBACK_GROUP = 'Visszajelzés a heti tervjavaslatról'
const LIVE_SUGGESTION_ID = '7b1e0c33-0000-4000-8000-0000000005a1'

describe('WeeklyPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the score hero, the delta, every item and the plan suggestion', () => {
    renderPage()
    expect(screen.getByText('Hét 21 áttekintés · Máj 18-24')).toBeInTheDocument()
    expect(screen.getByText('82')).toBeInTheDocument()
    expect(screen.getByText('+4')).toBeInTheDocument()
    expect(screen.getByText('vs hét 20')).toBeInTheDocument()
    expect(screen.getByText('Edzés volumen')).toBeInTheDocument()
    expect(screen.getByText('Niggle-mentes napok')).toBeInTheDocument()
    expect(screen.getByText('Mezo · heti tervjavaslat')).toBeInTheDocument()
    expect(screen.getByText(/Hét 22: tartsd ezt a Pull\/Push/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elfogad' })).toBeInTheDocument()
    expect(screen.getByText('Growth — heti')).toBeInTheDocument()
  })

  test('renders the feedback chips on the suggestion card (mezo-b3pp.15)', async () => {
    renderPage()
    expect(screen.getByRole('group', { name: FEEDBACK_GROUP })).toBeInTheDocument()
    // The parked Elfogad/Hangoljuk pair is a SEPARATE mock-only affordance — untouched.
    expect(screen.getByRole('button', { name: 'Elfogad' })).toBeInTheDocument()
    const up = screen.getByRole('button', { name: /Segített/ })
    expect(up).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(up)
    await waitFor(() => expect(up).toHaveAttribute('aria-pressed', 'true'))
  })
})

describe('WeeklyPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the composed review with real rows and the honest suggestion placeholder', async () => {
    renderPage()
    // default MSW fuel-week handler: factor 2717.5/3100 → 88% target
    expect(await screen.findByText('88% target')).toBeInTheDocument()
    expect(screen.getByText('vs előző hét')).toBeInTheDocument()
    expect(screen.getByText('Fehérje-napok')).toBeInTheDocument()
    expect(screen.getByText('A társ heti tervjavaslata hamarosan.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Elfogad' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Hét 22: tartsd ezt a Pull\/Push/)).not.toBeInTheDocument()
    // No suggestion → no artifact to vote on → no chips on the honest placeholder.
    expect(screen.queryByRole('group', { name: FEEDBACK_GROUP })).not.toBeInTheDocument()
  })

  test('renders the tanulom null-state when nothing is logged', async () => {
    server.use(
      http.get(`${API_BASE}/api/fuel/week/:start`, ({ params }) =>
        HttpResponse.json({ start: String(params.start), days: [] })),
      http.get(`${API_BASE}/api/biometrics/sleep`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    )
    renderPage()
    expect(await screen.findByText('tanulom')).toBeInTheDocument()
    expect(screen.queryByText('/100')).not.toBeInTheDocument()
  })

  it('renders the live suggestion prose WITHOUT the inert Elfogad/Hangoljuk buttons', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/weekly-suggestion`, () => HttpResponse.json({
      id: LIVE_SUGGESTION_ID,
      weekStart: '2026-07-06', prose: 'Élő heti javaslat.', generatedAt: '2026-07-06T06:00:00Z',
    })))
    renderPage()
    expect(await screen.findByText('Élő heti javaslat.')).toBeInTheDocument()
    expect(screen.queryByText('Elfogad')).not.toBeInTheDocument()
    expect(screen.queryByText('Hangoljuk')).not.toBeInTheDocument()
    // ...but the chips are NOT mock-only — the mezo-kr9v asymmetry must not come back.
    expect(screen.getByRole('group', { name: FEEDBACK_GROUP })).toBeInTheDocument()
  })

  it('a 👎 + reason on the suggestion writes the weekly_suggestion artifact (mezo-b3pp.15)', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/weekly-suggestion`, () => HttpResponse.json({
      id: LIVE_SUGGESTION_ID,
      weekStart: '2026-07-06', prose: 'Élő heti javaslat.', generatedAt: '2026-07-06T06:00:00Z',
    })))
    const puts: unknown[] = []
    server.use(http.put(`${API_BASE}/api/companion/feedback`, async ({ request }) => {
      const body = await request.json()
      puts.push(body)
      return HttpResponse.json({ ...(body as object), updatedAt: '2026-08-21T12:00:00Z' })
    }))
    renderPage()
    await screen.findByRole('group', { name: FEEDBACK_GROUP })

    await userEvent.click(screen.getByRole('button', { name: /Nem talált/ }))
    await userEvent.click(screen.getByRole('button', { name: 'rossz időzítés' }))

    await waitFor(() => expect(puts).toHaveLength(1))
    // Pins the WIRE payload — a wrong artifactKind or artifactId would otherwise stay green.
    expect(puts[0]).toMatchObject({
      artifactKind: 'weekly_suggestion',
      artifactId: LIVE_SUGGESTION_ID,
      verdict: 'down',
      reason: 'bad_timing',
    })
  })
})
