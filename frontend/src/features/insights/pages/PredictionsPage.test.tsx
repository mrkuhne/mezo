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
    // Prototype #page-josla hero (mezo-d20.11): i-kristaly + „68%" + „2 bevált · 60 napos pontosság".
    expect(screen.getByText('Előrejelzések')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.mz-bignum')?.textContent).toBe('68%'))
    // mock keeps the Phase-1 literal, localized view-side (the shipped English header was a designed fix)
    expect(screen.getByText('2 bevált · 60 napos pontosság')).toBeInTheDocument()
    expect(screen.getByText('Csütörtök Pull Day · Chest Row PR (107.5 × 8)')).toBeInTheDocument()
    expect(screen.getAllByText('◐ Folyamatban').length).toBeGreaterThan(0)
    expect(screen.getAllByText('✓ Bevált').length).toBeGreaterThan(0)
    // no English chip survives the localization pass
    expect(screen.queryByText('◐ Pending')).not.toBeInTheDocument()
    expect(screen.queryByText('✓ Validated')).not.toBeInTheDocument()
    expect(screen.getByText('✓ Bejött: RPE 8.2 · vacsora 20:50')).toBeInTheDocument()
  })

  test('status-washed tiles: pending → lavender + animated confidence bar, validated → sage (mezo-d20.5.6)', () => {
    const { container } = renderPage()
    const tiles = container.querySelectorAll('.mzp-pred')
    expect(tiles).toHaveLength(mockPredictions.length)
    const pending = container.querySelectorAll('.mzp-pred.lav')
    const validated = container.querySelectorAll('.mzp-pred.sage')
    expect(pending).toHaveLength(2)
    expect(validated).toHaveLength(2)
    // pending carries the animated confidence bar with the honest width; validated carries none
    const fill = pending[0].querySelector('.mzp-gbar div') as HTMLElement
    expect(fill).not.toBeNull()
    expect(fill.style.width).toBe('72%')
    expect(validated[0].querySelector('.mzp-gbar')).toBeNull()
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
    await waitFor(() => expect(document.querySelector('.mz-bignum')?.textContent).toBe('100%'))
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
