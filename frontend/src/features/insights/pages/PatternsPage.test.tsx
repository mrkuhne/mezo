import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { delay, http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { PatternsPage } from '@/features/insights/pages/PatternsPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <PatternsPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('PatternsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the hero, the motor prose and the lifecycle sections from the seeds', () => {
    renderPage()
    // Mozaik hero (mezo-d20.5.3): name + confirmed big number + honest sub line
    expect(screen.getByText('Minták')).toBeInTheDocument()
    expect(screen.getByText('megerősített összefüggés él a tudásban')).toBeInTheDocument()
    expect(screen.getByText('A motor állapota')).toBeInTheDocument()
    expect(screen.getByText(/kérdést/)).toBeInTheDocument()
    expect(screen.getByText(/Döntésre vár/)).toBeInTheDocument()
    expect(screen.getByText(/Megerősítve — él a tudásban/)).toBeInTheDocument()
    expect(screen.getByText('Adat-egészség')).toBeInTheDocument()
  })

  test('the 3×2 lifecycle grid renders six colorful cells; döntésre vár is the hot gold-ringed one', () => {
    const { container } = renderPage()
    const cells = container.querySelectorAll('.mnt-lcel')
    expect(cells).toHaveLength(6)
    // seeds: 2 decide → the hot skin (white + gold ring, pulse guarded in CSS) is armed
    const hot = container.querySelector('.mnt-lcel.hot') as HTMLElement
    expect(hot).not.toBeNull()
    expect(hot.textContent).toContain('döntésre vár')
    expect(hot.textContent).toContain('2')
    // the other five keep their prototype skins
    expect(container.querySelector('.mnt-lcel.c-sage')?.textContent).toContain('megerősítve')
    expect(container.querySelector('.mnt-lcel.c-lav')?.textContent).toContain('megfigyelés')
    expect(container.querySelector('.mnt-lcel.c-amber')?.textContent).toContain('még gyűlik')
  })

  test('lifecycle mosaics: confirmed tiles speak human confidence words, gathering tiles are dashed amber', () => {
    const { container } = renderPage()
    // p1 (confirmed, no monitor pair): honest "tanulom" chip on a sage tile, no fabricated stats
    const confirmedTile = container.querySelector('.mnt-ptile.sage') as HTMLElement
    expect(confirmedTile).not.toBeNull()
    expect(within(confirmedTile).getByText('tanulom')).toBeInTheDocument()
    // the 7 pattern-less monitor pairs are gathering → dashed tiles carrying the gate verdicts
    expect(container.querySelectorAll('.mnt-ptile.dashed')).toHaveLength(7)
    // raw statistics never reach a tile face
    expect(screen.queryByText(/r=/)).not.toBeInTheDocument()
  })

  test('lists the decide-bucket questions (pair-backed prefers the live questionHu)', () => {
    renderPage()
    // p2 (late-meal~next-sleep-quality) matches a monitor pair — the question comes from there.
    expect(screen.getByText('Rosszabbul alszol, ha későn eszel?')).toBeInTheDocument()
    // p3 has no matching monitor pair — falls back to the pattern's own title.
    expect(screen.getByText('Caffeine 14:00 utáni dózis → sleep onset +24 perc')).toBeInTheDocument()
  })

  test('confirming a decide card moves it into the Megerősítve bucket and settles to the sage acknowledgement', async () => {
    renderPage()
    const confirmButtons = screen.getAllByRole('button', { name: /Megerősítem/ })
    fireEvent.click(confirmButtons[0])
    await waitFor(() => {
      expect(screen.getByTestId('mnt-cnt-confirmed')).toHaveTextContent('2')
    })
    // prototype decdone: the decision settles to a sage acknowledgement row
    expect(screen.getByText('✓ Beépítettem a tudásba — mostantól számolok vele.')).toBeInTheDocument()
  })

  test('Adat-egészség expands to the coverage rings, thinnest-first', () => {
    renderPage()
    fireEvent.click(screen.getByText('Adat-egészség'))
    const labels = screen.getAllByTestId('coverage-label').map((el) => el.textContent)
    // thinnest first, tied at 0/60: Gyógyszer-ciklusnap (comes first in the seed array) then sportterhelés
    expect(labels[0]).toBe('Gyógyszer-ciklusnap')
    expect(labels).toHaveLength(12)
  })

  test('domain filter chips: multi-select and the "Mind" chip batch-clears all of them at once', () => {
    renderPage()
    const sleepChip = screen.getByRole('button', { name: /Alvás/ })
    const trainChip = screen.getByRole('button', { name: /Edzés/ })
    const mindChip = screen.getByRole('button', { name: 'Mind' })
    expect(mindChip).toHaveClass('chip', 'brand')

    fireEvent.click(sleepChip)
    fireEvent.click(trainChip)
    expect(mindChip).not.toHaveClass('brand')

    // one click on "Mind" clears BOTH active domains in the same batch (mezo-tk88.4 correction —
    // MotorStateHero calls onToggleDomain once per active domain synchronously; a non-functional
    // setState would drop all but the last toggle, leaving one domain filter stuck on).
    fireEvent.click(mindChip)
    expect(mindChip).toHaveClass('chip', 'brand')
  })

  test('a decide-bucket hypothesis entry with no monitor pair renders without a dead detail link (review fix, mezo-tk88.5)', () => {
    renderPage()
    // p3 (hyp-3fa1c2d9) has no matching monitor pair — its pairKey is never a real catalog key,
    // so a "/insights/patterns/hyp-3fa1c2d9" link would guarantee "Nincs ilyen minta.".
    const card = screen.getByText('Caffeine 14:00 utáni dózis → sleep onset +24 perc').closest('.card') as HTMLElement
    expect(within(card).queryByRole('link', { name: /Részletek és előzmények/ })).not.toBeInTheDocument()
    // a pair-backed decide card in the SAME bucket still gets its link.
    const pairBackedCard = screen.getByText('Rosszabbul alszol, ha későn eszel?').closest('.card') as HTMLElement
    expect(within(pairBackedCard).getByRole('link', { name: /Részletek és előzmények/ })).toBeInTheDocument()
  })

  test('a confirmed lifecycle row with no monitor pair renders as a plain row, no dead detail link (review fix, mezo-tk88.5)', () => {
    renderPage()
    // p1 (status: confirmed, pairKey "sport-load~next-sleep-quality") has no matching monitor pair
    // either — the confirmed bucket's mini-row falls back to the pattern's own title and must not link out.
    const title = screen.getByText('Magas sportterhelés → rákövetkező éjjel mélyebb alvás')
    expect(title.closest('a')).toBeNull()
  })

  test('?pair= redirects to the detail page', () => {
    render(
      <MemoryRouter initialEntries={['/mezo/patterns?pair=late-meal~next-sleep-quality']}>
        <Routes>
          <Route path="/mezo/patterns" element={<PatternsPage />} />
          <Route path="/mezo/patterns/:pairKey" element={<div>DETAIL STUB</div>} />
        </Routes>
      </MemoryRouter>,
      { wrapper: QueryWrapper },
    )
    expect(screen.getByText('DETAIL STUB')).toBeInTheDocument()
  })
})

describe('PatternsPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  const patternWire = {
    id: 'w1',
    kind: 'statistical',
    category: 'physiology',
    categoryLabel: 'Fiziológia',
    title: 'Alvásminőség ↔ másnapi edzés-RPE',
    mechanism: 'Erős negatív együttjárás.',
    evidence: ['r=-0.82', 'n=14 nap'],
    confidence: null,
    critique: null,
    status: 'proposed',
    pairKey: 'sleep-quality~next-day-training-rpe',
    lastDetectedAt: '2026-07-04T02:40:00Z',
  }

  const monitorWire = {
    windowFrom: '2026-06-13',
    windowTo: '2026-08-10',
    lookbackDays: 60,
    minN: 8,
    cron: '0 40 2 * * *',
    lastRunAt: '2026-08-11T00:40:00Z',
    pairs: [
      {
        key: 'sleep-quality~next-day-training-rpe',
        title: 'Alvásminőség ↔ másnapi edzés-RPE',
        category: 'physiology',
        categoryLabel: 'Fiziológia',
        lagDays: 1,
        metricAKey: 'sleep-quality',
        metricALabel: 'alvásminőség',
        metricBKey: 'training-rpe',
        metricBLabel: 'edzés-RPE',
        mechanismHu: 'A rosszabb alvás másnap nehezebbnek érződő edzést hozhat.',
        questionHu: 'Könnyebb az edzés, ha jól aludtál?',
        expectedDirection: 'negative',
        whenPositiveHu: 'a jobb alvás után {erősség} nehezebbnek érződött az edzés',
        whenNegativeHu: 'a jobb alvás után {erősség} könnyebbnek érződött az edzés',
        metricADomain: 'sleep',
        metricBDomain: 'train',
        verdict: 'live',
        alignedDays: 21,
        missingDays: null,
        bottleneckMetricKey: null,
        r: -0.42,
        n: 21,
        p: 0.058,
        status: null,
      },
    ],
    metrics: [
      {
        key: 'sleep-quality',
        label: 'alvásminőség',
        sourceHu: 'Alvás-napló',
        domain: 'sleep',
        coveredDays: 58,
        windowDays: 60,
        lastDayWithData: '2026-08-10',
        pairCount: 1,
      },
    ],
  }

  test('renders the honest loading state while the queries are unresolved, never a fabricated zero dashboard', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, async () => {
        await delay('infinite')
        return HttpResponse.json([patternWire])
      }),
      http.get(`${API_BASE}/api/companion/pattern/monitor`, async () => {
        await delay('infinite')
        return HttpResponse.json(monitorWire)
      }),
    )
    renderPage()

    expect(await screen.findByText('A minták betöltése…')).toBeInTheDocument()
    // the fabricated "0 kérdést … 0 vár a döntésedre" hero must NOT render during the cold load.
    expect(screen.queryByText('A motor állapota')).not.toBeInTheDocument()
    expect(screen.queryByText(/kérdést/)).not.toBeInTheDocument()
  })

  test('composes the hero + decision inbox + Adat-egészség from both endpoints', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () => HttpResponse.json([patternWire])),
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => HttpResponse.json(monitorWire)),
    )
    renderPage()

    // pair-backed statistical row: the card speaks the pair's authored question, not the raw title.
    expect(await screen.findByText('Könnyebb az edzés, ha jól aludtál?')).toBeInTheDocument()
    expect(screen.getByText(/Döntésre vár · 1/)).toBeInTheDocument()
    expect(screen.queryByText(/r=/)).not.toBeInTheDocument() // nyers statisztika sosem a kártyán

    fireEvent.click(screen.getByText('Adat-egészség'))
    expect(screen.getByText('alvásminőség')).toBeInTheDocument()
  })

  // mezo-mqdj: az éjszakai job a kapu-bukáskor sem nem frissíti, sem nem törli a már perzisztált
  // sort, így az az utolsó élő éjszaka statisztikájával itt marad. A Motor ugyanerre a párra
  // few_days-t mond — a két felület nem mondhat mást ugyanarról a párról.
  const staleMonitorWire = {
    ...monitorWire,
    pairs: [{ ...monitorWire.pairs[0], verdict: 'few_days', alignedDays: 4, missingDays: 4,
      bottleneckMetricKey: 'sleep-quality', r: null, n: null, p: null }],
  }

  test('a stale proposed row whose pair is no longer live leaves the decision inbox for gathering', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () => HttpResponse.json([patternWire])),
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => HttpResponse.json(staleMonitorWire)),
    )
    renderPage()

    // nem kérünk döntést olyan összefüggésre, amit a mai adat ki sem tud számolni
    expect(await screen.findByText(/Még gyűlik az adat/)).toBeInTheDocument()
    expect(screen.queryByText(/Döntésre vár/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Megerősítem/ })).not.toBeInTheDocument()
    // és a befagyott lelet-mondat sem mehet ki jelen időben
    expect(screen.queryByText(patternWire.mechanism)).not.toBeInTheDocument()

    // a gyűjtés-szekció alapból csukva — kinyitva a kapu saját nudge-a áll a soron
    fireEvent.click(screen.getByText(/Még gyűlik az adat/))
    expect(screen.getByText(/Még 4 nap adat ebből/)).toBeInTheDocument()
  })

  test('a monitoring row whose pair went non-live shows the gate verdict, not the frozen mechanism', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () =>
        HttpResponse.json([{ ...patternWire, status: 'monitoring' }]),
      ),
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => HttpResponse.json(staleMonitorWire)),
    )
    renderPage()

    fireEvent.click(await screen.findByText(/Megfigyelés alatt/))
    expect(screen.getByText(/Még 4 nap adat ebből/)).toBeInTheDocument()
    expect(screen.queryByText(patternWire.mechanism)).not.toBeInTheDocument()
  })

  test('a monitoring pattern with a live pair renders a lavender tile: evidence bar, human-word chip, detail link', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () =>
        HttpResponse.json([{ ...patternWire, status: 'monitoring' }]),
      ),
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => HttpResponse.json(monitorWire)),
    )
    const { container } = renderPage()

    expect(await screen.findByText(/Megfigyelés alatt/)).toBeInTheDocument()
    const tile = container.querySelector('.mnt-ptile.lav') as HTMLElement
    expect(tile).not.toBeNull()
    // n=21, p=0.058 → the HUMAN confidence word (confidenceMeta), never raw r/p
    expect(within(tile).getByText('ígéretes jel')).toBeInTheDocument()
    expect(screen.queryByText(/r=/)).not.toBeInTheDocument()
    // the animated evidence bar (alignedDays / lookbackDays) is present
    expect(tile.querySelector('.mnt-gbar')).not.toBeNull()
    // pair-backed tile links to the pattern detail page
    expect(tile.tagName).toBe('A')
  })

  test('a switch-off 404 on BOTH endpoints renders the honest degraded card, with no motor link', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () =>
        HttpResponse.json([{ code: 'NOT_FOUND' }], { status: 404 }),
      ),
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => new HttpResponse(null, { status: 404 })),
    )
    renderPage()

    expect(await screen.findByText(/minta-motor most nem elérhető/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  test('an empty, non-degraded state keeps the honest empty copy, with no motor link', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () =>
        HttpResponse.json({
          windowFrom: '2026-06-13',
          windowTo: '2026-08-10',
          lookbackDays: 60,
          minN: 8,
          cron: '0 40 2 * * *',
          lastRunAt: null,
          pairs: [],
          metrics: [],
        }),
      ),
    )
    renderPage()

    expect(
      await screen.findByText('Még nincs felismert minta — az éjszakai elemzés magától tölti, ahogy gyűlnek a napok.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  test('a non-404 monitor failure renders an honest error state with a retry, not a blank page', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => new HttpResponse(null, { status: 500 })),
    )
    renderPage()

    expect(await screen.findByText('Nem sikerült betölteni a motor állapotát.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  })
})

// mezo-hq44: a Minták életciklus-fejlécei és a döntés-nyugtázások ikonosak. A ✓ marad
// glifa: az a ház pipa-idiómája (rutin/küldetés/szokás), amihez ez a kör nem nyúl.
describe('PatternsPage — emoji→ikon (mezo-hq44)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  const wire = (status: string) => ({
    id: 'w9', kind: 'statistical', category: 'physiology', categoryLabel: 'Fiziológia',
    title: 'Alvásminőség ↔ másnapi edzés-RPE', mechanism: 'Erős negatív együttjárás.',
    evidence: ['r=-0.82'], confidence: null, critique: null, status,
    pairKey: 'sleep-quality~next-day-training-rpe', lastDetectedAt: '2026-07-04T02:40:00Z',
  })

  test('a „Döntésre vár" fejléc harang-ikont rajzol, nem 🔔 glifát', () => {
    renderPage()
    const decide = screen.getByText(/Döntésre vár · /)
    expect(decide.querySelector('svg')).toBeTruthy()
    expect(decide.textContent).not.toMatch(/🔔/)
  })

  test('a „Megfigyelés alatt" fejléc szem-ikont rajzol, nem 👁 glifát', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () => HttpResponse.json([wire('monitoring')])),
    )
    renderPage()
    const monitoring = await screen.findByText(/Megfigyelés alatt/)
    expect(monitoring.querySelector('svg')).toBeTruthy()
    expect(monitoring.textContent).not.toMatch(/👁/)
  })

  test('az „Elvetve" fejléc x-ikont rajzol, nem ✕ glifát', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () => HttpResponse.json([wire('rejected')])),
    )
    renderPage()
    const rejected = await screen.findByText(/^Elvetve$/)
    expect(rejected.querySelector('svg')).toBeTruthy()
    expect(rejected.textContent).not.toMatch(/✕/)
  })

  test('a ✓ Megerősítve fejléc szándékosan glifa marad (házi pipa-idióma)', () => {
    renderPage()
    expect(screen.getByText('✓ Megerősítve — él a tudásban')).toBeInTheDocument()
  })

  test('az elvetés nyugtázása x-ikont kap, a mondat változatlan', async () => {
    const { container } = renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: 'Elvetem' })[0])
    const ack = await waitFor(() => {
      const el = container.querySelector('.mnt-decdone') as HTMLElement
      expect(el).not.toBeNull()
      return el
    })
    expect(ack.querySelector('svg')).toBeTruthy()
    expect(ack.textContent).not.toMatch(/✕/)
    expect(ack.textContent).toMatch(/Elvetve — nem hozom fel újra\./)
  })
})
