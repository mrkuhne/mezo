import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { delay, http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { PatternDetailPage } from '@/features/insights/pages/PatternDetailPage'

// The Task 11 mock seed's one hand-authored showcase pair — confirmed, full snapshot/decision/
// reinforcement history, aligned days, impact (data/insights/insights.ts). Every other catalog
// pair (e.g. this one, `verdict: 'few_days'`) synthesizes to `pattern: null` — a still-gathering
// pair with no persisted row yet.
const SHOWCASE_KEY = 'sleep-quality~next-day-training-rpe'
const GATHERING_KEY = 'sleep-duration~next-day-training-rpe'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/mezo/patterns/:pairKey" element={<PatternDetailPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('PatternDetailPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  const answer = () => screen.getByRole('heading', { level: 1 })

  // mezo-rstt7: egy olvasat, egy elrendezés — a válasz a h1, alatta az adat, a szabály, a
  // történet és a számok, minden `detail`-re ugyanabban a sorrendben.
  test('the confirmed showcase holds: settled line, revoke link, ghost dot and the four sections', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    // the glass back pill: a direct open (first history entry) names the list it falls back to
    expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent(/‹\s*Minták/)
    expect(answer()).toHaveTextContent('Tartja magát')
    expect(screen.getByText('BEÉPÜLT')).toHaveClass('pmx-status')
    expect(screen.queryByText('Minta részletei')).not.toBeInTheDocument()
    expect(screen.getByText('Bekerült a Tudástárba, Mezo számol vele.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Megerősítem/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Elvetem/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mégsem igaz rám — visszavonom' })).toBeInTheDocument()
    expect(screen.getByTestId('lean-then')).toBeInTheDocument()
    expect(screen.getByText('Mit mutat az adat')).toBeInTheDocument()
    expect(screen.getByText('A szabály')).toBeInTheDocument()
    expect(screen.getByText('Ami eddig történt')).toBeInTheDocument()
    expect(screen.getByText('Számok, ha érdekel')).toBeInTheDocument()
    expect(screen.getByText('Mit kezd ezzel az app')).toBeInTheDocument()
  })

  test('Számok, ha érdekel keeps the second-level technical disclosure and the freeze note', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    const diagnostics = screen.getByText('Számok, ha érdekel').closest('details') as HTMLDetailsElement
    expect(diagnostics.open).toBe(false)
    expect(within(diagnostics).getByText('ablak, források és technikai adatok')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Számok, ha érdekel'))
    expect(diagnostics.open).toBe(true)
    fireEvent.click(screen.getByText('Technikai számok'))
    expect(screen.getByText('-0.58')).toBeInTheDocument()
    expect(screen.getByText(/befagytak/)).toBeInTheDocument()
  })

  test('Ami eddig történt tells the catalog history through the journal', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    const fold = screen.getByText('Ami eddig történt').closest('details') as HTMLDetailsElement
    expect(within(fold).getByText(/Először számolhatóvá vált — 14 közös nap/)).toBeInTheDocument()
  })

  test('a still-gathering catalog pair has no stored row: no decision at all, just the pips', () => {
    renderAt(`/mezo/patterns/${GATHERING_KEY}`)
    expect(answer()).toHaveTextContent('Még gyűjtöm')
    expect(screen.getByText('FIGYELT PÁR')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '6 nap a 8-ból' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Figyeljük|Elvetem|Megerősítem/ })).not.toBeInTheDocument()
    expect(document.querySelector('.pmx-dec')).toBeNull()
    expect(screen.queryByText('Mit kezd ezzel az app')).not.toBeInTheDocument()
  })

  test('the weekend pair says why it still collects: the group balance', () => {
    renderAt('/mezo/patterns/weekend~late-meal-hour')
    expect(answer()).toHaveTextContent('Még gyűjtöm')
    expect(screen.getByText(/8 hétköznapi nap mellett még csak 1 hétvégi nap van/)).toBeInTheDocument()
  })

  test('the reflection hypothesis reads a strong signal and lights the recommended decision', () => {
    // the seeded `ref-anna-1` row is `monitoring` (data/insights/insights.ts) — live r .52 over
    // 16 days, plan direction positive → „Erős jel", and „Megerősítem" is the recommended one
    renderAt('/mezo/patterns/ref-anna-sleep')
    expect(answer()).toHaveTextContent('Erős jel')
    expect(screen.getByText('FIGYELJÜK')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Megerősítem' })).toHaveClass('is-rec')
    expect(screen.getByRole('button', { name: 'Figyeljük tovább' })).not.toHaveClass('is-rec')
    // the plan-driven events tell the story through the evidence log
    expect(screen.getByText(/Igen, figyeld — de nem Anna miatt/)).toBeInTheDocument()
  })

  test('the reflection background fold names the plan window and the reflection run', () => {
    renderAt('/mezo/patterns/ref-anna-sleep')
    fireEvent.click(screen.getByText('Számok, ha érdekel'))
    const grid = document.querySelector('.pdt-diag-grid') as HTMLElement
    expect(within(grid).getByText('Adatablak').nextSibling?.textContent).toBe('60 nap')
    const expected = new Date('2026-09-12T01:40:00Z')
      .toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
    expect(within(grid).getByText('Utolsó számítás').nextSibling?.textContent).toBe(expected)
  })

  test('a gathering reflection quotes Mezo and offers to keep watching', () => {
    renderAt('/mezo/patterns/ref-mock-gyulik')
    expect(answer()).toHaveTextContent('Még gyűjtöm')
    const quote = document.querySelector('.pmx-quote') as HTMLElement
    expect(quote).toHaveTextContent('Az úszás napján estére lejjebb ment az energiád.')
    expect(quote).not.toHaveTextContent('A hosszú úszós napokon')
    expect(screen.getByRole('button', { name: 'Figyeljük tovább' })).toBeInTheDocument()
    expect(screen.getByText('Az átlagot 8 napnál mutatom.')).toBeInTheDocument()
  })

  test('a rejected reflection offers only to watch it again', () => {
    renderAt('/mezo/patterns/ref-mock-elvetve')
    expect(answer()).toHaveTextContent('Elvetetted')
    expect(screen.getByText('ELVETVE')).toBeInTheDocument()
    const decisions = document.querySelectorAll('.pmx-dec button')
    expect([...decisions].map((b) => b.textContent)).toEqual(['Mégis figyeljük'])
  })

  test('a click on Elvetem reaches the decide mutation', async () => {
    renderAt('/mezo/patterns/ref-mock-gyulik')
    fireEvent.click(screen.getByRole('button', { name: 'Elvetem' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Elvetetted' })).toBeInTheDocument()
    expect(screen.getByText('ELVETVE')).toBeInTheDocument()
  })

  test('a dot tap shows the tooltip without re-rendering the hero', () => {
    renderAt('/mezo/patterns/ref-anna-sleep')
    const hero = answer()
    const dot = screen.getAllByRole('button', { name: /^2026-08-27:/ })[0]
    fireEvent.click(dot)
    expect(document.querySelector('.pmx-tip')).not.toBeNull()
    expect(screen.getByText('alváshossz: 7.4')).toBeInTheDocument()
    expect(answer()).toBe(hero)
  })

  test('the zone chart is the one glass surface; the hero is a frameless halo', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    const glass = document.querySelectorAll('.glass:not(.uv-back)')
    expect(glass).toHaveLength(1)
    expect(glass[0]).toHaveClass('pmx-chart')
    expect(document.querySelector('.pmx-hero')).not.toHaveClass('glass')
  })

  test('a persisted hypothesis without a monitor pair opens an honest actionable detail', async () => {
    renderAt('/mezo/patterns/hyp-3fa1c2d9')
    expect(screen.getByText('Caffeine 14:00 utáni dózis → sleep onset +24 perc')).toBeInTheDocument()
    expect(answer()).toHaveTextContent('Mezo sejtése')
    expect(screen.getByText('MIRE ÉPÜLT')).toBeInTheDocument()
    expect(screen.getByText(/átlagosan 24 perccel kitolja/)).toBeInTheDocument()
    expect(screen.getByText('7 nap mérve')).toBeInTheDocument()
    expect(screen.getByText('Stabil pattern, alacsony variancia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Figyeljük' }))
    expect(await screen.findByText(/Ezt a mintát tovább figyeljük/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Figyeljük' })).not.toBeInTheDocument()
    expect(document.querySelectorAll('.glass:not(.uv-back)')).toHaveLength(0)
  })

  test('unknown key renders the honest not-found state with a back chip', () => {
    renderAt('/mezo/patterns/nonsense~key')
    // mezo-d20.11 → mezo-me75u.13: a direct open has no in-app history, so the glass back pill
    // names and opens the LIST (from the wall it would say „Vissza" and pop to the wall).
    expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent(/‹\s*Minták/)
    expect(screen.getByText(/Nincs ilyen minta/)).toBeInTheDocument()
    expect(screen.getByText('Minta részletei')).toBeInTheDocument()
  })
})

describe('PatternDetailPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  const wirePair = {
    key: SHOWCASE_KEY,
    title: 'Alvásminőség ↔ másnapi edzés-RPE',
    category: 'physiology',
    categoryLabel: 'Fiziológia',
    lagDays: 1,
    metricAKey: 'sleep-quality',
    metricALabel: 'alvásminőség',
    metricAValueKind: 'number',
    metricBKey: 'training-rpe',
    metricBLabel: 'edzés-RPE',
    metricBValueKind: 'number',
    mechanismHu: 'A rosszabb alvás másnap nehezebbnek érződő edzést hozhat.',
    questionHu: 'Könnyebb az edzés, ha jól aludtál?',
    expectedDirection: 'negative',
    whenPositiveHu: 'a jobb alvás után {erősség} nehezebbnek érződött az edzés',
    whenNegativeHu: 'a jobb alvás után {erősség} könnyebbnek érződött az edzés',
    metricADomain: 'sleep',
    metricBDomain: 'train',
    verdict: 'frozen',
    alignedDays: 32,
    r: -0.58,
    n: 32,
    p: 0.001,
    status: 'confirmed',
  }

  test('renders the honest pending state while the detail request is unresolved', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/pair/pending-key`, async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )
    renderAt('/mezo/patterns/pending-key')
    expect(await screen.findByText('A minta betöltése…')).toBeInTheDocument()
  })

  test('renders a retryable error state when loading fails', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/pair/error-key`, () =>
        HttpResponse.json({ code: 'UNEXPECTED' }, { status: 500 }),
      ),
    )
    renderAt('/mezo/patterns/error-key')
    expect(await screen.findByText('Nem sikerült betölteni a mintát.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  })

  test('a confirmed detail payload renders the one layout', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/pair/${SHOWCASE_KEY}`, () =>
        HttpResponse.json({
          pair: wirePair,
          pattern: {
            id: 'w-pattern-1',
            kind: 'statistical',
            pairKey: SHOWCASE_KEY,
            category: 'physiology',
            categoryLabel: 'Fiziológia',
            title: 'Alvásminőség ↔ másnapi edzés-RPE',
            mechanism: 'A rosszabb alvás másnap nehezebbnek érződő edzést hozhat.',
            evidence: ['r=-0.58', 'n=32 nap'],
            status: 'confirmed',
          },
          events: [
            { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14, p: 0.52 },
            { kind: 'snapshot', occurredAt: '2026-08-13T02:40:00Z', r: -0.58, n: 32, p: 0.001 },
            { kind: 'confirmed', occurredAt: '2026-08-13T09:15:00Z' },
          ],
          days: [
            { date: '2026-08-12', a: 7.1, b: 5.6 },
            { date: '2026-08-13', a: 8.8, b: 4.1 },
          ],
          impact: {
            fact: { id: 'fact-1', text: 'Ha rosszul alszol, nehezebbnek érzed másnap az edzést.', reinforcementCount: 4, includeInPrompt: true },
            predictions: [{ id: 'pr1', title: 'Csütörtök RPE > 7', status: 'validated' }],
            experiments: [],
            challenges: [],
          },
        }),
      ),
    )
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    expect(await screen.findByText('Mit kezd ezzel az app')).toBeInTheDocument()
    // a frozen payload with only 2 aligned days is below the monitor's 8-day minimum: confirmed,
    // but barely measured — the reading never claims a signal the days cannot carry
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Még alig mért')
    expect(screen.getByText('Mit mutat az adat')).toBeInTheDocument()
    expect(screen.getByText('A szabály')).toBeInTheDocument()
    expect(screen.getByText('Ami eddig történt')).toBeInTheDocument()
    expect(screen.getByText('Számok, ha érdekel')).toBeInTheDocument()
  })

  test('an 8+1 binary pair stays in collection and explains the missing weekend evidence', async () => {
    const weekendKey = 'weekend~late-meal-hour'
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/pair/${weekendKey}`, () =>
        HttpResponse.json({
          pair: {
            ...wirePair,
            key: weekendKey,
            title: 'Hétvége ↔ utolsó étkezés ideje',
            lagDays: 0,
            metricAKey: 'weekend',
            metricALabel: 'hétvége',
            metricAValueKind: 'binary',
            metricBKey: 'late-meal-hour',
            metricBLabel: 'utolsó étkezés ideje',
            metricBValueKind: 'clock_hour',
            questionHu: 'Hétvégén később csúszik az utolsó étkezés?',
            verdict: 'imbalanced_groups',
            alignedDays: 9,
            groupZeroDays: 8,
            groupOneDays: 1,
            requiredPerGroup: 3,
            r: null,
            n: null,
            p: null,
            status: null,
          },
          pattern: null,
          events: [],
          days: [
            { date: '2026-08-24', a: 0, b: 23.6333 },
            { date: '2026-08-25', a: 0, b: 21.3333 },
            { date: '2026-08-26', a: 0, b: 23.7167 },
            { date: '2026-08-27', a: 0, b: 12.85 },
            { date: '2026-08-29', a: 1, b: 14.5833 },
            { date: '2026-08-31', a: 0, b: 17.9333 },
            { date: '2026-09-01', a: 0, b: 17.0333 },
            { date: '2026-09-02', a: 0, b: 22.2667 },
            { date: '2026-09-03', a: 0, b: 10.1167 },
          ],
          impact: { fact: null, predictions: [], experiments: [], challenges: [] },
        }),
      ),
    )
    renderAt(`/mezo/patterns/${weekendKey}`)

    expect(await screen.findByRole('heading', { level: 1, name: 'Még gyűjtöm' })).toBeInTheDocument()
    expect(screen.getByText(/8 hétköznapi nap mellett még csak 1 hétvégi nap van/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
    expect(screen.queryByText(/r=-0\.27/)).not.toBeInTheDocument()
    expect(screen.getByText('Számok, ha érdekel')).toBeInTheDocument()
  })

  test('a pairless confirmed hypothesis uses the persisted artifact without invented charts or diagnostics', async () => {
    const pairless = {
      id: 'artifact-1',
      kind: 'ai_hypothesis',
      category: 'response',
      categoryLabel: 'Válasz',
      title: 'A késői koffein kitolja az elalvást',
      mechanism: 'A naplóid alapján a délutáni koffein mellett később indult az alvás.',
      evidence: ['7 nap megfigyelés', 'További adatot gyűjtünk'],
      confidence: 0.74,
      critique: null,
      status: 'confirmed',
      pairKey: 'hyp-pairless-confirmed',
      lastDetectedAt: '2026-09-03T02:40:00Z',
    }
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/pair/${pairless.pairKey}`, () =>
        HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 }),
      ),
      http.get(`${API_BASE}/api/companion/pattern`, () => HttpResponse.json([pairless])),
    )

    renderAt(`/mezo/patterns/${pairless.pairKey}`)
    expect(await screen.findByText(pairless.title)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Csak megérzés')
    expect(screen.getByText('BEÉPÜLT')).toBeInTheDocument()
    expect(screen.getByText(/a te megerősítésed tartja életben/)).toBeInTheDocument()
    expect(screen.getByText('MIRE ÉPÜLT')).toBeInTheDocument()
    expect(screen.getByText('7 nap megfigyelés')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mégsem igaz rám — visszavonom' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
    expect(screen.queryByText('Mit mutat az adat')).not.toBeInTheDocument()
    expect(screen.queryByText('Számok, ha érdekel')).not.toBeInTheDocument()
  })

  // Reflexió S6 (mezo-eq85.6): a laborfüzet a KÖZÖS MSW alapértelmezésből jön — nincs
  // teszt-lokális `server.use`, tehát a drót-alak maga a szerződés, nem a teszt kényelme.
  test('the shared MSW default serves the laborfüzet for the reflection key', async () => {
    renderAt('/mezo/patterns/ref-anna-sleep')
    expect(await screen.findByRole('heading', { level: 1, name: 'Erős jel' })).toBeInTheDocument()
    expect(screen.getByText('FIGYELJÜK')).toBeInTheDocument()
    expect(screen.getByText(/Igen, figyeld — de nem Anna miatt/)).toBeInTheDocument()
    // nyers r/p sosem a hős arcán — csak a becsukott „Számok, ha érdekel" fold alatt
    expect(document.querySelector('.pmx-hero')?.textContent).not.toContain('0.52')
    expect(screen.getByText('0.52').closest('details.pdt-fold')).not.toBeNull()
  })

  test('a decision on the reflection page posts to the decide endpoint', async () => {
    const posted: unknown[] = []
    server.use(
      http.post(`${API_BASE}/api/companion/pattern/:id/decision`, async ({ params, request }) => {
        posted.push({ id: params.id, body: await request.json() })
        return HttpResponse.json({ code: 'UNEXPECTED' }, { status: 500 })
      }),
    )
    renderAt('/mezo/patterns/ref-anna-sleep')
    fireEvent.click(await screen.findByRole('button', { name: 'Megerősítem' }))
    await vi.waitFor(() => expect(posted).toEqual([{ id: 'ref-anna-1', body: { decision: 'confirm' } }]))
  })

  test('a 404 renders the honest not-found state', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/pair/nonsense-key`, () =>
        HttpResponse.json([{ code: 'NOT_FOUND' }], { status: 404 }),
      ),
    )
    renderAt('/mezo/patterns/nonsense-key')
    expect(await screen.findByText(/Nincs ilyen minta/)).toBeInTheDocument()
  })
})
