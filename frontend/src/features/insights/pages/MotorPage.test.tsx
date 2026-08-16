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
    expect(screen.queryByText('Könnyebb az edzés hosszabb alvás után?')).not.toBeInTheDocument() // few_days kiszűrve
    expect(screen.getByText('Elrontja az alvásod a stresszes nap?')).toBeInTheDocument() // élő marad

    fireEvent.click(liveChip) // toggle vissza — minden látszik újra
    expect(screen.getByText('Könnyebb az edzés hosszabb alvás után?')).toBeInTheDocument()
  })

  /** A csukott domén-szekciók fejléceire kattintva mindent láthatóvá tesz. */
  const openAllSections = () => {
    for (const header of screen.getAllByTestId('domain-header')) {
      if (header.getAttribute('aria-expanded') === 'false') fireEvent.click(header)
    }
  }

  // 'frozen' is no longer asserted here: the medication pair was the seed's only frozen entry,
  // and it now permanently reads no_data (mezo-lwmq) — no fixture pair carries 'frozen' any more.
  test('renders every verdict with its honest sentence (nudge on few_days)', () => {
    renderPage()
    openAllSections()
    expect(screen.getAllByText('ÉLŐ')).toHaveLength(2)
    expect(screen.getByText('Még 2 nap adat ebből: edzés-RPE — és ez a pár életre kel!')).toBeInTheDocument()
    expect(
      screen.getByText('Nincs még illeszkedő nap — a(z) sportterhelés üres ebben az ablakban.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A(z) vízbevitel nem mozdul az ablakban — így nincs mit korrelálni.'),
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
    expect(titles[0]).toBe('Elrontja az alvásod a stresszes nap?')
    expect(titles[1]).toBe('Rosszabbul alszol, ha későn eszel?')
    // Edzés-szekció (B=train): live → few_days → no_data
    expect(titles[2]).toBe('Könnyebb az edzés, ha jól aludtál?')
    expect(titles[3]).toBe('Könnyebb az edzés hosszabb alvás után?')
    expect(titles[4]).toBe('Elveszi a sport a másnapi gym-erőt?')
    expect(titles[7]).toBe('Meglátszik a napi kalória a reggeli súlyon?') // Test-szekció a sor végén
  })

  test('shows a cross-domain chip when metric-A lives in another domain', () => {
    renderPage()
    // Stressz (mind) → alvásminőség (sleep): a sleep-szekció sora kap "Mentális & társas" chipet
    const row = screen
      .getByText('Elrontja az alvásod a stresszes nap?')
      .closest('[data-testid="pair-row"]') as HTMLElement
    expect(within(row).getByText(/Mentális & társas/)).toBeInTheDocument()
  })

  test('a live card composes the human finding and expands to sources + raw stats + link', () => {
    renderPage()
    const row = screen
      .getByText('Elrontja az alvásod a stresszes nap?')
      .closest('[data-testid="pair-row"]') as HTMLElement
    // a kártyán mindig ott a két blokk: amit keresünk + amit eddig látunk (Igen: egyező irány)
    expect(within(row).getByText(/Amit keresünk/)).toBeInTheDocument()
    expect(within(row).getByText('A stresszes nap ronthatja az aznapi alvásminőséget.')).toBeInTheDocument()
    expect(within(row).getByText(/Igen: a stresszesebb napokon/)).toBeInTheDocument()
    expect(within(row).getByText('határozottan')).toBeInTheDocument() // |r|=0.61 → határozottan, félkövér
    expect(within(row).getByText('megbízható jel')).toBeInTheDocument() // p=0.001
    fireEvent.click(within(row).getByTestId('gate-pair-title'))
    expect(within(row).getByText(/Check-in sheet/)).toBeInTheDocument()
    expect(within(row).getByText('r=-0.61 · n=34 · p=0.001')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: /Minta megnyitása/ })).toHaveAttribute(
      'href',
      '/insights/patterns?pair=checkin-stress~sleep-quality',
    )
  })

  test('offers no pattern link on a non-live expanded row', () => {
    renderPage()
    openAllSections()
    const row = screen
      .getByText('Elveszi a sport a másnapi gym-erőt?')
      .closest('[data-testid="pair-row"]') as HTMLElement
    fireEvent.click(within(row).getByTestId('gate-pair-title'))
    expect(within(row).getByText(/Amit keresünk/)).toBeInTheDocument()
    expect(within(row).queryByRole('link', { name: /Minta megnyitása/ })).toBeNull()
  })

  test('coverage rings: waiting label on live-less metrics, expand reveals source + pairs', () => {
    renderPage()
    const rows = screen.getAllByTestId('coverage-ring-row')
    // a legvékonyabb elöl, holtversenyben (0/60): Gyógyszer-ciklusnap (a seed-tömbben előbb áll),
    // majd sportterhelés — mindkettő egyetlen párja no_data → "vár rá"
    expect(within(rows[0]).getByText('Gyógyszer-ciklusnap')).toBeInTheDocument()
    expect(within(rows[0]).getByText(/1 pár vár rá/)).toBeInTheDocument()
    fireEvent.click(rows[0])
    expect(within(rows[0]).getByText('Gyógyszer-napló')).toBeInTheDocument()
    expect(within(rows[0]).getByText('A ciklus vége felé nő az étvágyad?')).toBeInTheDocument()

    expect(within(rows[1]).getByText('sportterhelés')).toBeInTheDocument()
    expect(within(rows[1]).getByText(/1 pár vár rá/)).toBeInTheDocument()
    fireEvent.click(rows[1])
    expect(within(rows[1]).getByText('Sport-napló (perc)')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Elveszi a sport a másnapi gym-erőt?')).toBeInTheDocument()
    // az alvásminőségnek van élő párja → sima "3 párban"
    const sleepRow = rows.find((r) => within(r).queryByText('alvásminőség'))!
    expect(within(sleepRow).getByText(/3 párban él/)).toBeInTheDocument()
  })

  test('orders the coverage list thinnest-first', () => {
    // The seed's metrics array is deliberately unsorted (insights.ts) — this asserts the full
    // 12-label sequence so the test proves MotorPage's own sort, not an already-sorted fixture.
    renderPage()
    const labels = screen.getAllByTestId('coverage-label').map((el) => el.textContent)
    expect(labels).toEqual([
      'Gyógyszer-ciklusnap',
      'sportterhelés',
      'gym-volumen',
      'reggeli súlyváltozás',
      'edzés-RPE',
      'utolsó étkezés ideje',
      'vízbevitel',
      'alváshossz',
      'napi kalória',
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
              questionHu: 'Rosszabbul alszol, ha későn eszel?',
              expectedDirection: 'negative',
              whenPositiveHu: 'a későbbi vacsorák után {erősség} jobban aludtál',
              whenNegativeHu: 'a későbbi vacsorák után {erősség} rosszabbul aludtál',
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
