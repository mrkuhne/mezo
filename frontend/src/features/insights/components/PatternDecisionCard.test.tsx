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
    .toHaveAttribute('href', `/insights/patterns/${pair.key}`)
  // nyers statisztika SOSEM a kártyán:
  expect(screen.queryByText(/r=/)).not.toBeInTheDocument()
})
