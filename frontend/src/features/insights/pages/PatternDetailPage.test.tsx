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

  test('confirmed showcase pair renders the clear story and a read-only judged state', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    // the house full-page header row (AiUsagePage idiom): back chevron + h1
    expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Minták')
    expect(screen.getByText('Minta részletei')).toBeInTheDocument()
    expect(screen.getByText('Hogyan változott a kapcsolat?')).toBeInTheDocument()
    expect(screen.getByText('Az eddigi napok')).toBeInTheDocument()
    expect(screen.getByText('A minta története')).toBeInTheDocument()
    expect(screen.getByText('Mit kezd ezzel az app')).toBeInTheDocument()
    expect(screen.getByText('Hogyan számoltuk?')).toBeInTheDocument()
    expect(screen.getByText('Ezt a kapcsolatot már megerősítetted.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Elvetem' })).not.toBeInTheDocument()
    // the header's own "Részletek és előzmények →" link would point at this very page — suppressed
    // on the detail page (review fix)
    expect(screen.queryByRole('link', { name: /Részletek és előzmények/ })).not.toBeInTheDocument()
  })

  test('a judged pattern cannot be decided again from its detail page', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    expect(screen.getByText('Megerősítve')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Megerősít/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Elvetem' })).not.toBeInTheDocument()
  })

  test('the strength caption uses first/last snapshot n and the evidence chart marks the latest day', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    // showcase events: first snapshot n=14 (jún 3), last snapshot n=32 (aug 13)
    expect(screen.getByText(/14 napról 32-re/)).toBeInTheDocument()
    // showcase days: latest aligned day is 2026-08-13
    expect(screen.getByLabelText('legutóbbi nap: 2026-08-13')).toBeInTheDocument()
  })

  test('Hogyan számoltuk? contains a second-level technical disclosure and freeze note', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    const diagnostics = screen.getByText('Hogyan számoltuk?').closest('details') as HTMLDetailsElement
    expect(diagnostics.open).toBe(false)
    fireEvent.click(screen.getByText('Hogyan számoltuk?'))
    expect(diagnostics.open).toBe(true)
    const technical = screen.getByText('Technikai számok').closest('details') as HTMLDetailsElement
    expect(technical.open).toBe(false)
    fireEvent.click(screen.getByText('Technikai számok'))
    expect(technical.open).toBe(true)
    expect(screen.getByText('-0.58')).toBeInTheDocument()
    expect(screen.getByText(/befagytak/)).toBeInTheDocument()
  })

  test('Napok listája toggles the inline aligned-days table', () => {
    renderAt(`/mezo/patterns/${SHOWCASE_KEY}`)
    const dayList = screen.getByText('Napok listája →').closest('details') as HTMLDetailsElement
    expect(dayList.open).toBe(false)
    fireEvent.click(screen.getByText('Napok listája →'))
    expect(dayList.open).toBe(true)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: 'alvásminőség' })).toBeInTheDocument()
  })

  test('gathering pair renders the gate nudge, honest empty states and no premature impact or decisions', () => {
    renderAt(`/mezo/patterns/${GATHERING_KEY}`)
    expect(screen.getByText(/Még \d+ nap adat/)).toBeInTheDocument() // verdictSentence's few_days nudge
    expect(screen.getByText('Az eddigi napok')).toBeInTheDocument()
    expect(screen.getByText('Még nincs jelentős esemény — az új adatok töltik majd.')).toBeInTheDocument()
    expect(screen.getByText(/Még nincs elég nap az összevetéshez/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Mit kezd ezzel az app')).not.toBeInTheDocument()
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
    expect(screen.getByText('Hogyan változott a kapcsolat?')).toBeInTheDocument()
    expect(screen.getByText('Az eddigi napok')).toBeInTheDocument()
    expect(screen.getByText('A minta története')).toBeInTheDocument()
    expect(screen.getByText('Hogyan számoltuk?')).toBeInTheDocument()
    expect(screen.getByText('Ezt a kapcsolatot már megerősítetted.')).toBeInTheDocument()
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

    expect(await screen.findByText('Még nincs elég hétvégi adat.')).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByText('Még 2 hétvégi nap kell.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
    expect(screen.queryByText(/r=-0\.27/)).not.toBeInTheDocument()
    expect(screen.getByText('Hogyan számoltuk?')).toBeInTheDocument()
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
