import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
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

  test('confirmed showcase pair renders all five blocks in order + the judged header', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    // the house full-page header row (AiUsagePage idiom): back chevron + h1
    expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Minták')
    expect(screen.getByText('Minta részletei')).toBeInTheDocument()
    expect(screen.getByText('Hogyan erősödött a jel')).toBeInTheDocument()
    expect(screen.getByText(/nap, amiből ez kijött/)).toBeInTheDocument()
    expect(screen.getByText('A minta története')).toBeInTheDocument()
    expect(screen.getByText('Mit kezd ezzel az app')).toBeInTheDocument()
    expect(screen.getByText(/Motor-diagnosztika/)).toBeInTheDocument()
    expect(screen.getByText(/Megerősítetted/)).toBeInTheDocument()
    // the reused PatternDecisionCard reflects the judged state through its active button label
    expect(screen.getByRole('button', { name: 'Megerősítve' })).toBeInTheDocument()
    // raw r/n/p never appear outside the collapsed diagnostics section
    expect(screen.queryByText(/r=-0\.42/)).not.toBeInTheDocument()
    // the header's own "Részletek és előzmények →" link would point at this very page — suppressed
    // on the detail page (review fix)
    expect(screen.queryByRole('link', { name: /Részletek és előzmények/ })).not.toBeInTheDocument()
    // the diagnostics section (mockup: no count) never shows a list-style "· N" suffix
    expect(screen.queryByText(/Motor-diagnosztika · \d/)).not.toBeInTheDocument()
  })

  test('a decision made from the detail header updates the page without a reload (review fix, mezo-tk88.5)', async () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    expect(screen.getByRole('button', { name: 'Megerősítve' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Elvetem' }))

    // the pattern is no longer confirmed — the confirm button reverts to its inactive label
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Megerősítem' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Megerősítve' })).not.toBeInTheDocument()
    // downstream of the same status flip: the impact card falls back to the future-tense row
    expect(screen.getByText(/Ha megerősíted/)).toBeInTheDocument()
  })

  test('the strength/scatter captions use the first/last snapshot n and the latest day', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    // showcase events: first snapshot n=14 (jún 3), last snapshot n=32 (aug 13)
    expect(screen.getByText(/14 napról 32-re/)).toBeInTheDocument()
    // showcase days: latest aligned day is 2026-08-13
    expect(screen.getByText(/legutóbbi: aug 13/)).toBeInTheDocument()
  })

  test('opening Motor-diagnosztika reveals the raw stats and the freeze note (judged row)', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    expect(screen.queryByText(/r=-0\.42/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/Motor-diagnosztika/))
    expect(screen.getByText(/r=-0\.42/)).toBeInTheDocument()
    expect(screen.getByText(/számok/)).toBeInTheDocument()
    expect(screen.getByText(/befagytak/)).toBeInTheDocument()
  })

  test('Napok listája toggles the inline aligned-days table', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Napok listája →'))
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('alvásminőség')).toBeInTheDocument()
  })

  test('gathering pair (no persisted row) renders the gate nudge, honest empty states and the future-tense impact row', () => {
    renderAt(`/mezo/patterns/${GATHERING_KEY}`)
    expect(screen.getByText(/Még \d+ nap adat/)).toBeInTheDocument() // verdictSentence's few_days nudge
    // "Még nincs előzmény…" is the shared no-history line — it renders TWICE (strength card +
    // journal card, review fix item 3), both describing the same empty `events: []`.
    expect(screen.getAllByText('Még nincs előzmény — az éjszakai futások töltik.')).toHaveLength(2)
    // scatter card: days.length < 2 gets the future-tense title, not "A 0 nap…" (review fix item 4)
    expect(screen.getByText('Napok, amikből ez majd kijön')).toBeInTheDocument()
    expect(screen.queryByText(/nap, amiből ez kijött/)).not.toBeInTheDocument()
    expect(screen.getByText(/Még nincs elég nap az összevetéshez/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Napok listája →' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(/Ha megerősíted/)).toBeInTheDocument()
    // the plain header has no decision buttons
    expect(screen.queryByRole('button', { name: /Megerősítem/ })).not.toBeInTheDocument()
  })

  test('unknown key renders the honest not-found state with a back chip', () => {
    renderAt('/mezo/patterns/nonsense~key')
    // mezo-d20.11: the ad-hoc chevron became the house PageHead chip, and it goes back to the
    // LIST the detail was opened from, not the hub.
    expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Minták')
    expect(screen.getByText(/Nincs ilyen minta/)).toBeInTheDocument()
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
    metricBKey: 'training-rpe',
    metricBLabel: 'edzés-RPE',
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

  test('a confirmed detail payload renders the five blocks', async () => {
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
    expect(screen.getByText('Hogyan erősödött a jel')).toBeInTheDocument()
    expect(screen.getByText(/nap, amiből ez kijött/)).toBeInTheDocument()
    expect(screen.getByText('A minta története')).toBeInTheDocument()
    expect(screen.getByText(/Motor-diagnosztika/)).toBeInTheDocument()
    expect(screen.getByText(/Megerősítetted/)).toBeInTheDocument()
  })

  test('hour + binary metric values render human-readable in the days table, the scatter and the diagnostics (mezo-fy97)', async () => {
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
            metricBKey: 'late-meal-hour',
            metricBLabel: 'utolsó étkezés ideje',
            questionHu: 'Hétvégén később csúszik az utolsó étkezés?',
            verdict: 'live',
            alignedDays: 3,
            r: -0.37383063546416445,
            n: 14,
            p: 0.18794141905232353,
            status: null,
          },
          pattern: null,
          events: [],
          days: [
            { date: '2026-07-01', a: 0, b: 15.683333333333334 },
            { date: '2026-07-04', a: 1, b: 6.416666666666667 },
            { date: '2026-07-19', a: 1, b: 20.3 },
          ],
          impact: { fact: null, predictions: [], experiments: [], challenges: [] },
        }),
      ),
    )
    renderAt(`/mezo/patterns/${weekendKey}`)

    // scatter x-axis: a binary metric gets named columns, not alacsony/magas
    expect(await screen.findByText('hétköznap')).toBeInTheDocument()
    expect(screen.getByText('hétvége')).toBeInTheDocument()
    expect(screen.queryByText('alacsony')).not.toBeInTheDocument()

    // days table: fractional hours become wall-clock times, 0/1 becomes igen/nem
    fireEvent.click(screen.getByText('Napok listája →'))
    expect(screen.getByText('15:41')).toBeInTheDocument()
    expect(screen.getByText('06:25')).toBeInTheDocument()
    expect(screen.getByText('20:18')).toBeInTheDocument()
    expect(screen.getAllByText('igen')).toHaveLength(2)
    expect(screen.getByText('nem')).toBeInTheDocument()
    expect(screen.queryByText(/15\.68333/)).not.toBeInTheDocument()

    // diagnostics: r/p rounded, never full double precision
    fireEvent.click(screen.getByText(/Motor-diagnosztika/))
    expect(screen.getByText(/r=-0\.37 · n=14 · p=0\.188/)).toBeInTheDocument()
    expect(screen.queryByText(/0\.37383063546416445/)).not.toBeInTheDocument()
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
