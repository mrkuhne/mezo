import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { MotorPage } from '@/features/insights/pages/MotorPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <MotorPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('MotorPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the engine-state header with the window, the gate and the raw cron', () => {
    renderPage()
    expect(screen.getByText('2026-06-13 – 2026-08-10')).toBeInTheDocument()
    expect(screen.getByText('60 nap')).toBeInTheDocument()
    expect(screen.getByText('min. 8 illeszkedő nap')).toBeInTheDocument()
    expect(screen.getByText('0 40 2 * * *')).toBeInTheDocument()
  })

  test('renders the hero with the live count and the engine facts', () => {
    renderPage()
    expect(screen.getByText('2 élő összefüggés')).toBeInTheDocument()
    expect(screen.getByText(/8 figyelt pár/)).toBeInTheDocument()
    expect(screen.getByText(/12 mért metrika/)).toBeInTheDocument()
  })

  test('filters pairs by verdict chip toggle (multi, off by default)', () => {
    renderPage()
    const liveChip = screen.getByRole('button', { name: /Élő/ })
    expect(liveChip).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(liveChip)
    expect(liveChip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Alváshossz ↔ másnapi edzés-RPE')).not.toBeInTheDocument() // few_days kiszűrve
    expect(screen.getByText('Stressz-szint ↔ aznapi alvásminőség')).toBeInTheDocument() // élő marad

    fireEvent.click(liveChip) // toggle vissza — minden látszik újra
    expect(screen.getByText('Alváshossz ↔ másnapi edzés-RPE')).toBeInTheDocument()
  })

  /** A csukott domén-szekciók fejléceire kattintva mindent láthatóvá tesz. */
  const openAllSections = () => {
    for (const header of screen.getAllByTestId('domain-header')) {
      if (header.getAttribute('aria-expanded') === 'false') fireEvent.click(header)
    }
  }

  test('renders every verdict with its honest sentence (nudge on few_days)', () => {
    renderPage()
    openAllSections()
    expect(screen.getAllByText('ÉLŐ')).toHaveLength(2)
    expect(screen.getByText('🎯 Még 2 nap adat ebből: edzés-RPE — és ez a pár életre kel!')).toBeInTheDocument()
    expect(
      screen.getByText('Nincs még illeszkedő nap — a(z) sportterhelés üres ebben az ablakban.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A(z) vízbevitel nem mozdul az ablakban — így nincs mit korrelálni.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Te ítélted meg (megerősítve) — az éjszakai job nem számolja újra.'),
    ).toBeInTheDocument()
  })

  test('groups pairs into domain sections by the metric-B domain, ordered within', () => {
    renderPage()
    openAllSections()
    const headers = screen.getAllByTestId('domain-header').map((el) => el.textContent)
    expect(headers[0]).toContain('Alvás')
    expect(headers[1]).toContain('Edzés')
    const titles = screen.getAllByTestId('gate-pair-title').map((el) => el.textContent)
    // Alvás-szekció (B=sleep): élő elöl, aztán a kevés-napos
    expect(titles[0]).toBe('Stressz-szint ↔ aznapi alvásminőség')
    expect(titles[1]).toBe('Késői étkezés ↔ rákövetkező alvásminőség')
    // Edzés-szekció (B=train): live → few_days → no_data
    expect(titles[2]).toBe('Alvásminőség ↔ másnapi edzés-RPE')
    expect(titles[3]).toBe('Alváshossz ↔ másnapi edzés-RPE')
    expect(titles[4]).toBe('Sportterhelés ↔ másnapi gym-volumen')
    expect(titles[7]).toBe('Napi kalória ↔ másnap reggeli súlyváltozás') // Test-szekció a sor végén
  })

  test('shows a cross-domain chip when metric-A lives in another domain', () => {
    renderPage()
    // Stressz (mind) → alvásminőség (sleep): a sleep-szekció sora kap "Mentális & társas" chipet
    const row = screen
      .getByText('Stressz-szint ↔ aznapi alvásminőség')
      .closest('[data-testid="pair-row"]') as HTMLElement
    expect(within(row).getByText('Mentális & társas')).toBeInTheDocument()
  })

  test('expands a live row to mechanism + source pills + pattern link', () => {
    renderPage()
    const row = screen
      .getByText('Stressz-szint ↔ aznapi alvásminőség')
      .closest('[data-testid="pair-row"]') as HTMLElement
    fireEvent.click(within(row).getByTestId('gate-pair-title'))
    expect(within(row).getByText(/Miért figyeljük/)).toBeInTheDocument()
    expect(within(row).getByText('A stresszes nap ronthatja az aznapi alvásminőséget.')).toBeInTheDocument()
    expect(within(row).getByText(/Check-in sheet/)).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: /Minta megnyitása/ })).toHaveAttribute(
      'href',
      '/insights/patterns?pair=checkin-stress~sleep-quality',
    )
  })

  test('offers no pattern link on a non-live expanded row', () => {
    renderPage()
    openAllSections()
    const row = screen
      .getByText('Sportterhelés ↔ másnapi gym-volumen')
      .closest('[data-testid="pair-row"]') as HTMLElement
    fireEvent.click(within(row).getByTestId('gate-pair-title'))
    expect(within(row).getByText(/Miért figyeljük/)).toBeInTheDocument()
    expect(within(row).queryByRole('link', { name: /Minta megnyitása/ })).toBeNull()
  })

  test('orders the coverage list thinnest-first', () => {
    // The seed's metrics array is deliberately unsorted (insights.ts) — this asserts the full
    // 12-label sequence so the test proves MotorPage's own sort, not an already-sorted fixture.
    renderPage()
    const labels = screen.getAllByTestId('coverage-label').map((el) => el.textContent)
    expect(labels).toEqual([
      'sportterhelés',
      'gym-volumen',
      'reggeli súlyváltozás',
      'edzés-RPE',
      'utolsó étkezés ideje',
      'vízbevitel',
      'alváshossz',
      'napi kalória',
      'Reta-ciklusnap',
      'stressz-szint',
      'energia-szint',
      'alvásminőség',
    ])
  })
})

describe('MotorPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the degraded card on a 404', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => new HttpResponse(null, { status: 404 })),
    )
    renderPage()
    expect(await screen.findByText('A minta-motor most nem elérhető.')).toBeInTheDocument()
  })

  test('says the engine has not found a pattern yet when lastRunAt is null', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () =>
        HttpResponse.json({
          windowFrom: '2026-06-13', windowTo: '2026-08-10', lookbackDays: 60, minN: 8,
          cron: '0 40 2 * * *', lastRunAt: null, pairs: [], metrics: [],
        }),
      ),
    )
    renderPage()
    expect(await screen.findByText('még nem talált mintát')).toBeInTheDocument()
  })

  test('renders an honest error state — with a retry — on a non-404 failure instead of a blank page', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => new HttpResponse(null, { status: 500 })),
    )
    renderPage()
    expect(await screen.findByText('Nem sikerült betölteni a motor állapotát.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  })

  test('says there is no overlapping day when a no_data pair\'s bottleneck metric is not itself empty', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () =>
        HttpResponse.json({
          windowFrom: '2026-06-13', windowTo: '2026-08-10', lookbackDays: 60, minN: 8,
          cron: '0 40 2 * * *', lastRunAt: '2026-08-11T00:40:00Z',
          pairs: [
            {
              key: 'late-meal-hour~sleep-quality-2',
              title: 'Késői étkezés ↔ rákövetkező alvásminőség (teszt)',
              category: 'trigger',
              categoryLabel: 'Trigger',
              lagDays: 1,
              metricAKey: 'late-meal-hour',
              metricALabel: 'utolsó étkezés ideje',
              metricBKey: 'sleep-quality',
              metricBLabel: 'alvásminőség',
              mechanismHu: 'A késői étkezés ronthatja a rákövetkező éjszaka minőségét.',
              metricADomain: 'fuel', metricBDomain: 'sleep',
              verdict: 'no_data',
              alignedDays: 0,
              missingDays: null,
              bottleneckMetricKey: 'late-meal-hour',
              r: null, n: null, p: null, status: null,
            },
          ],
          metrics: [
            { key: 'late-meal-hour', label: 'utolsó étkezés ideje', sourceHu: 'Étkezés-napló (utolsó étkezés)', domain: 'fuel', coveredDays: 16, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
            { key: 'sleep-quality', label: 'alvásminőség', sourceHu: 'Alvás-napló', domain: 'sleep', coveredDays: 58, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 3 },
          ],
        }),
      ),
    )
    renderPage()
    fireEvent.click(await screen.findByTestId('domain-header')) // nincs élő pár → a szekció csukva indul
    expect(
      screen.getByText(
        'Nincs még illeszkedő nap — nincs átfedő nap a(z) utolsó étkezés ideje és a(z) alvásminőség között ebben az ablakban.',
      ),
    ).toBeInTheDocument()
  })
})
