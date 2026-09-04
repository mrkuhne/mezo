import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PatternDecisionCard } from '@/features/insights/components/PatternDecisionCard'
import { patternMonitor } from '@/data/insights/insights'
import type { Pattern } from '@/data/types'

// The shared `patterns` mock catalog (insights.ts) predates the statistical/hypothesis `kind`
// split (mezo-fj1g) — its 3 seeded rows are all kind-less AI-hypothesis-style entries with
// `confidence`/`critique`, and `insightsData.test.tsx` pins that exact shape ("three patterns,
// all above the confidence floor"). Rather than mutate that shared fixture (breaking an
// unrelated, already-green test outside this task's scope), build a statistical+proposed
// Pattern here directly — paired with a real `patternMonitor` catalog entry so the scenario
// mirrors the mockup's first decision card exactly (mezo-tk88.4 Task 9).
const pair = patternMonitor.pairs.find((p) => p.key === 'sleep-quality~next-day-training-rpe')!
const statistical: Pattern = {
  id: 's1',
  pairKey: pair.key,
  category: pair.category,
  categoryLabel: pair.categoryLabel,
  title: pair.title,
  mechanism: pair.mechanismHu,
  evidence: [],
  kind: 'statistical',
  status: 'proposed',
}

test('renders question title, decision verbs and the detail link', () => {
  render(
    <MemoryRouter>
      <PatternDecisionCard pattern={statistical} pair={pair} onDecide={() => {}} showExplainer />
    </MemoryRouter>,
  )
  expect(screen.getByText(pair.questionHu)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Megerősítem/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Figyeljük' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Elvetem' })).toBeInTheDocument()
  expect(screen.getByText('Mi történik a döntéseddel')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Részletek és előzmények/ }))
    .toHaveAttribute('href', `/mezo/patterns/${pair.key}`)
  // nyers statisztika SOSEM a kártyán:
  expect(screen.queryByText(/r=/)).not.toBeInTheDocument()
})

// mezo-d20.11 (1:1 hűség-audit): a döntés-sor a prototípus .decrow-ja lett — korall CTA + két
// ghost, 44pt célpontokkal. Az „Elvetem" SOHA nem hordhat --error-* tokent: a sötét téma
// error-rámpája valódi piros (#F7B3AE), a terrakotta a padló.
test('the decision row wears the prototype .decrow pills and never a red token', () => {
  const { container } = render(
    <MemoryRouter>
      <PatternDecisionCard pattern={statistical} pair={pair} onDecide={() => {}} showExplainer />
    </MemoryRouter>,
  )
  expect(container.querySelector('.mzh-decrow')).not.toBeNull()
  expect(container.querySelector('.mzh-cta')).not.toBeNull()
  const reject = screen.getByRole('button', { name: 'Elvetem' })
  expect(reject).toHaveClass('mzh-ghost', 'is-no')
  // no inline --error-* anywhere in the card (the guardrail's failure mode was a style attribute)
  expect(container.innerHTML).not.toMatch(/--error-/)
})

// mezo-d20.11: az AI-hipotézis soroknak nincs n/p párja, így a `confidenceMeta` nem tud
// megszólalni — a kártya utolsó angol szövege („conf 69%") magyarra fordult.
test('an AI-hypothesis row states its confidence in Hungarian, never as „conf N%"', () => {
  const hypothesis = { ...statistical, kind: 'ai_hypothesis' as const, confidence: 0.69 }
  render(
    <MemoryRouter>
      <PatternDecisionCard pattern={hypothesis} pair={null} onDecide={() => {}} showDetailLink={false} />
    </MemoryRouter>,
  )
  expect(screen.getByText('bizonyosság 69%')).toBeInTheDocument()
  expect(screen.queryByText(/conf /)).not.toBeInTheDocument()
})

// mezo-mqdj: az éjszakai job a kapu-bukáskor nem nyúl a már perzisztált sorhoz, így a befagyott
// `mechanism` mondat ("Erős pozitív együttjárás … az elmúlt 60 napban") a mai adatról állítana
// valótlant. A részlet-oldal ezt a kártyát használja fejlécként elavult sorra is.
test('a non-live pair replaces the frozen mechanism sentence with the honest verdict', () => {
  const stalePair = { ...pair, verdict: 'few_days' as const, r: null, n: null, p: null, missingDays: 4 }
  render(
    <MemoryRouter>
      <PatternDecisionCard pattern={statistical} pair={stalePair} onDecide={() => {}} showDetailLink={false} />
    </MemoryRouter>,
  )
  expect(screen.getByText(/Még 4 nap adat ebből/)).toBeInTheDocument()
  expect(screen.queryByText(statistical.mechanism!)).not.toBeInTheDocument()
})

test('a live pair still shows the finding sentence, not the verdict', () => {
  const livePair = { ...pair, verdict: 'live' as const, r: -0.55, n: 20, p: 0.01 }
  render(
    <MemoryRouter>
      <PatternDecisionCard pattern={statistical} pair={livePair} onDecide={() => {}} showDetailLink={false} />
    </MemoryRouter>,
  )
  expect(screen.queryByText(/nap adat ebből/)).not.toBeInTheDocument()
  expect(screen.getByText(/Eddig ebbe az irányba mutatnak a napjaid:/)).toBeInTheDocument()
})

test('showDetailLink={false} suppresses the self-referential detail link (mezo-tk88.5 review fix)', () => {
  render(
    <MemoryRouter>
      <PatternDecisionCard pattern={statistical} pair={pair} onDecide={() => {}} showDetailLink={false} />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('link', { name: /Részletek és előzmények/ })).not.toBeInTheDocument()
})

// mezo-hq44: az „Amit eddig látunk" szemöldök 📈 helyett trend-ikont rajzol.
test('mezo-hq44: az „Amit eddig látunk" szemöldök ikonos, glifa nélkül', () => {
  const { container } = render(
    <MemoryRouter>
      <PatternDecisionCard pattern={statistical} pair={pair} onDecide={() => {}} showExplainer />
    </MemoryRouter>,
  )
  const eyebrow = Array.from(container.querySelectorAll('.eyebrow'))
    .find((e) => /Amit eddig látunk/.test(e.textContent ?? '')) as HTMLElement
  expect(eyebrow).toBeTruthy()
  expect(eyebrow.querySelector('svg')).toBeTruthy()
  expect(eyebrow.textContent).not.toMatch(/📈/)
})
