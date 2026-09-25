import { render, screen } from '@testing-library/react'
import { PatternDetailHero } from '@/features/insights/components/PatternDetailHero'
import type { Pattern, PatternMonitorPair, PatternRowStatus } from '@/data/types'

const pair: PatternMonitorPair = {
  key: 'sleep-quality~next-day-training-rpe',
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
  verdict: 'live',
  alignedDays: 24,
  missingDays: null,
  bottleneckMetricKey: null,
  groupZeroDays: null,
  groupOneDays: null,
  requiredPerGroup: null,
  r: -0.58,
  n: 24,
  p: 0.008,
  status: null,
}

function pattern(status: PatternRowStatus): Pattern {
  return {
    evidenceHits: 0,
    evidenceMisses: 0,
    id: `pattern-${status}`,
    pairKey: pair.key,
    category: 'physiology',
    categoryLabel: 'Fiziológia',
    title: pair.title,
    mechanism: pair.mechanismHu,
    evidence: [],
    status,
    kind: 'statistical',
  }
}

test.each([
  { name: 'live strong', pairPatch: {}, status: 'proposed' as const, pill: 'Döntésre vár', action: true },
  { name: 'live weak', pairPatch: { r: -0.17, p: 0.42 }, status: 'proposed' as const, pill: 'Még bizonytalan', action: false },
  { name: 'monitoring', pairPatch: {}, status: 'monitoring' as const, pill: 'Figyeljük', action: false },
  { name: 'confirmed', pairPatch: { verdict: 'frozen' as const, status: 'confirmed' as const }, status: 'confirmed' as const, pill: 'Megerősítve', action: false },
  { name: 'rejected', pairPatch: { verdict: 'frozen' as const, status: 'rejected' as const }, status: 'rejected' as const, pill: 'Elvetve', action: false },
])('$name maps to the intended hero and action state', ({ pairPatch, status, pill, action }) => {
  const { container } = render(<PatternDetailHero pair={{ ...pair, ...pairPatch }} pattern={pattern(status)} dayCount={24} onDecide={vi.fn()} />)
  expect(screen.getByText(pill)).toBeInTheDocument()
  expect(container.querySelector('[data-pattern-domain="train"] svg')).not.toBeNull()
  expect(container.textContent).not.toMatch(/🏋️/)
  if (action) expect(screen.getByRole('button', { name: 'Megerősítem' })).toBeInTheDocument()
  else expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
})

// mezo-bsb6h: a megítélt pár `n`-je a döntés pillanatáé, a gyűrű a mostani grafikoné — ha eltér,
// a két számot megnevezve mondjuk ki, nem csupaszon egymás mellett.
test('befagyott pár: eltérő napszámnál megnevezi, melyik a döntésé és melyik a grafikoné', () => {
  render(<PatternDetailHero pair={{ ...pair, verdict: 'frozen', status: 'confirmed', n: 32, alignedDays: 32 }}
    pattern={pattern('confirmed')} dayCount={24} onDecide={() => {}} />)
  expect(screen.getByLabelText('24 nap a grafikonon')).toBeInTheDocument()
  expect(screen.getByText(/A döntésedkor 32 közös nap/)).toBeInTheDocument()
  expect(screen.getByText('Azóta az ablak továbbcsúszott: a grafikon most 24 napot mutat.')).toBeInTheDocument()
})

test('befagyott pár: egyező napszámnál nincs magyarázó sor', () => {
  render(<PatternDetailHero pair={{ ...pair, verdict: 'frozen', status: 'confirmed' }}
    pattern={pattern('confirmed')} dayCount={24} onDecide={() => {}} />)
  expect(screen.queryByText(/A döntésedkor/)).toBeNull()
  expect(screen.queryByText(/továbbcsúszott/)).toBeNull()
})

test('élő pár: a közös nap mondat változatlan', () => {
  render(<PatternDetailHero pair={pair} pattern={pattern('proposed')} dayCount={24} onDecide={() => {}} />)
  expect(screen.getByText(/^24 közös nap/)).toBeInTheDocument()
})
