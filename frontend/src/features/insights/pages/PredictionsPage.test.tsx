import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { PredictionsPage } from '@/features/insights/pages/PredictionsPage'
import { predictions as mockPredictions } from '@/data/insights/insights'

const renderPage = () =>
  render(
    <MemoryRouter>
      <PredictionsPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

const FEEDBACK_GROUP = 'Visszajelzés az előrejelzésről'

describe('PredictionsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the header, pending + validated states, confidence and outcome — Hungarian chips (mezo-d20.5.6)', async () => {
    renderPage()
    expect(screen.getByText('Aktív predikciók')).toBeInTheDocument()
    // Üveg hero (mezo-me75u.9): the gradient accuracy numeral „68%" + „2 bevált · 60 napos pontosság".
    expect(screen.getByText('Előrejelzések')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('prediction-accuracy').textContent).toBe('68%'))
    // mock keeps the Phase-1 literal, localized view-side (the shipped English header was a designed fix)
    expect(screen.getByText('2 bevált · 60 napos pontosság')).toBeInTheDocument()
    expect(screen.getByText('Csütörtök Pull Day · Chest Row PR (107.5 × 8)')).toBeInTheDocument()
    // status pills: 3D icon + Hungarian word — no text glyph (bible rule 45), no English chip
    const pendingPills = Array.from(document.querySelectorAll('.m9e-st')).filter((el) => el.textContent === 'Folyamatban')
    expect(pendingPills.length).toBeGreaterThan(0)
    expect(pendingPills[0].querySelector('svg.t-ico')).toBeTruthy()
    expect(Array.from(document.querySelectorAll('.m9e-st')).some((el) => el.textContent === 'Bevált')).toBe(true)
    expect(screen.queryByText(/[◐◯✓]/)).not.toBeInTheDocument()
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
    expect(screen.queryByText('Validated')).not.toBeInTheDocument()
    const actual = screen.getByText('Bejött: RPE 8.2 · vacsora 20:50')
    expect(actual).toHaveClass('tf-after')
    expect(actual.querySelector('svg.t-ico')).toBeTruthy()
  })

  test('ranked cases: pending → sky glass + confidence bar, closed → flat, never red (mezo-me75u.9)', () => {
    const { container } = renderPage()
    const tiles = container.querySelectorAll('.m9e-pred')
    expect(tiles).toHaveLength(mockPredictions.length)
    const pending = container.querySelectorAll('.m9e-pred[data-status="pending"]')
    const validated = container.querySelectorAll('.m9e-pred[data-status="validated"]')
    expect(pending).toHaveLength(2)
    expect(validated).toHaveLength(2)
    pending.forEach((card) => expect(card).toHaveClass('glass', 'tf-c-sky'))
    validated.forEach((card) => {
      expect(card).toHaveClass('tf-flatc', 'tf-s-sage')
      expect(card).not.toHaveClass('glass')
    })
    // pending carries the confidence bar with the honest width; validated carries none
    const fill = pending[0].querySelector('.uv-bar > b') as HTMLElement
    expect(fill).not.toBeNull()
    expect(fill.style.getPropertyValue('--w')).toBe('72%')
    expect(validated[0].querySelector('.uv-bar')).toBeNull()
    // the feedback chips wear the 3D thumbs on the glass page
    expect(container.querySelectorAll('.fbk-chips.is-3d')).toHaveLength(mockPredictions.length)
    // the entrance choreography is armed once
    expect(container.querySelector('.mz-play')).not.toBeNull()
  })

  test('renders one feedback chip row per prediction card (mezo-b3pp.15)', async () => {
    renderPage()
    expect(screen.getAllByRole('group', { name: FEEDBACK_GROUP })).toHaveLength(mockPredictions.length)
    const ups = screen.getAllByRole('button', { name: /Segített/ })
    await userEvent.click(ups[0])
    // Only that card's chip flips — each card mounts its own instance, keyed by prediction id.
    await waitFor(() => expect(ups[0]).toHaveAttribute('aria-pressed', 'true'))
    expect(ups[1]).toHaveAttribute('aria-pressed', 'false')
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
            basis: 'Gyógyszer-ciklus D3-D7 alacsonyabb intake.',
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
    // one validated of one closed row → the derived hero, Hungarian (mezo-d20.11: the header
    // moved into the prototype's page-hero — big number + sub line)
    await waitFor(() => expect(screen.getByTestId('prediction-accuracy').textContent).toBe('100%'))
    expect(screen.getByText('1 bevált · pontosság')).toBeInTheDocument()
    expect(screen.queryByText('hamarosan')).not.toBeInTheDocument()
    expect(screen.queryByText('2 bevált · 60 napos pontosság')).not.toBeInTheDocument()
    expect(screen.queryByText(/validated/)).not.toBeInTheDocument()
    // The chips are not mock-only — both live rows carry their own row.
    expect(screen.getAllByRole('group', { name: FEEDBACK_GROUP })).toHaveLength(2)
  })

  test('a 👎 + reason on one card writes only that prediction (mezo-b3pp.15)', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/prediction`, () =>
        HttpResponse.json([
          {
            id: 'p1', title: 'Hét 27 testsúly csökken', basis: 'Alacsonyabb intake.',
            confidence: 0.6, metricKey: 'weight_trend', expectedDirection: 'down',
            validFrom: '2026-07-07', validTo: '2026-07-13', status: 'pending',
            generatedAt: '2026-07-07T06:30:00Z',
          },
          {
            id: 'p2', title: 'Alvás javul', basis: 'Korábbi lefekvés.',
            confidence: 0.5, metricKey: 'sleep_avg', expectedDirection: 'up',
            validFrom: '2026-06-30', validTo: '2026-07-06', status: 'pending',
            generatedAt: '2026-06-30T06:30:00Z',
          },
        ]),
      ),
    )
    const puts: unknown[] = []
    server.use(http.put(`${API_BASE}/api/companion/feedback`, async ({ request }) => {
      const body = await request.json()
      puts.push(body)
      return HttpResponse.json({ ...(body as object), updatedAt: '2026-08-21T12:00:00Z' })
    }))
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('group', { name: FEEDBACK_GROUP })).toHaveLength(2))

    // The reason row is per-card state: opening it on the FIRST card must not open it on the second.
    await userEvent.click(screen.getAllByRole('button', { name: /Nem talált/ })[0])
    expect(screen.getAllByRole('button', { name: 'pontatlan' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'pontatlan' }))

    await waitFor(() => expect(puts).toHaveLength(1))
    // Pins the WIRE payload — a wrong artifactKind or artifactId would otherwise stay green.
    expect(puts[0]).toMatchObject({
      artifactKind: 'prediction', artifactId: 'p1', verdict: 'down', reason: 'inaccurate',
    })
  })

  test('renders the honest still-learning null-state on the default empty array', async () => {
    renderPage()
    expect(
      await screen.findByText('Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Aktív predikciók')).not.toBeInTheDocument())
    // Nothing predicted → nothing to vote on → no chips on the „tanulom" placeholder.
    expect(screen.queryByRole('group', { name: FEEDBACK_GROUP })).not.toBeInTheDocument()
  })
})
