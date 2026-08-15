import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
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

  test('renders the hero sentence, tiles and lifecycle sections from the seeds', () => {
    renderPage()
    expect(screen.getByText('A motor állapota')).toBeInTheDocument()
    expect(screen.getByText(/kérdést/)).toBeInTheDocument()
    expect(screen.getByText(/Döntésre vár/)).toBeInTheDocument()
    expect(screen.getByText(/Megerősítve — él a tudásban/)).toBeInTheDocument()
    expect(screen.getByText('Adat-egészség')).toBeInTheDocument()
  })

  test('lists the decide-bucket questions (pair-backed prefers the live questionHu)', () => {
    renderPage()
    // p2 (late-meal~next-sleep-quality) matches a monitor pair — the question comes from there.
    expect(screen.getByText('Rosszabbul alszol, ha későn eszel?')).toBeInTheDocument()
    // p3 has no matching monitor pair — falls back to the pattern's own title.
    expect(screen.getByText('Caffeine 14:00 utáni dózis → sleep onset +24 perc')).toBeInTheDocument()
  })

  test('confirming a decide card moves it into the Megerősítve bucket', async () => {
    renderPage()
    const confirmButtons = screen.getAllByRole('button', { name: /Megerősítem/ })
    fireEvent.click(confirmButtons[0])
    await waitFor(() => {
      expect(screen.getByText(/Megerősítve — él a tudásban · 2/)).toBeInTheDocument()
    })
  })

  test('Adat-egészség expands to the coverage rings, thinnest-first', () => {
    renderPage()
    fireEvent.click(screen.getByText('Adat-egészség'))
    const labels = screen.getAllByTestId('coverage-label').map((el) => el.textContent)
    expect(labels[0]).toBe('sportterhelés') // 0 covered days — thinnest
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

  test('?pair= redirects to the detail page', () => {
    render(
      <MemoryRouter initialEntries={['/insights?pair=late-meal~next-sleep-quality']}>
        <Routes>
          <Route path="/insights" element={<PatternsPage />} />
          <Route path="/insights/patterns/:pairKey" element={<div>DETAIL STUB</div>} />
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
