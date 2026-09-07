import { fireEvent, render, screen } from '@testing-library/react'
import { HypothesisStateCard } from '@/features/insights/components/HypothesisStateCard'
import type { Pattern, PatternMonitorPair, PatternRowStatus, PatternTestPlan } from '@/data/types'

const plan: PatternTestPlan = {
  seriesA: 'people:anna',
  seriesB: 'sleep-duration-h',
  seriesALabel: '„Anna” a szövegeidben',
  seriesBLabel: 'alváshossz',
  lagDays: 1,
  expectedDirection: 'positive',
  minN: 8,
  windowDays: 60,
}

const pair: PatternMonitorPair = {
  key: 'ref-anna-sleep',
  title: 'Anna és az alvásod',
  category: 'trigger',
  categoryLabel: 'Kapcsolatok',
  lagDays: 1,
  metricAKey: 'people:anna',
  metricALabel: '„Anna” a szövegeidben',
  metricAValueKind: 'binary',
  metricBKey: 'sleep-duration-h',
  metricBLabel: 'alváshossz',
  metricBValueKind: 'number',
  mechanismHu: 'Anna említése mellett hosszabb alvás jött ki.',
  questionHu: 'Ha Anna szerepel a naplódban, másnap többet alszol?',
  expectedDirection: 'positive',
  whenPositiveHu: '{erősség} pozitív együttjárás',
  whenNegativeHu: '{erősség} fordított együttjárás',
  metricADomain: 'mind',
  metricBDomain: 'sleep',
  verdict: 'live',
  alignedDays: 16,
  missingDays: null,
  bottleneckMetricKey: null,
  groupZeroDays: 12,
  groupOneDays: 4,
  requiredPerGroup: 3,
  r: 0.31,
  n: 16,
  p: 0.24,
  status: null,
}

function pattern(patch: Partial<Pattern> = {}): Pattern {
  return {
    id: 'ref-1',
    pairKey: 'ref-anna-sleep',
    hypothesisKey: 'ref-anna-sleep',
    category: 'trigger',
    categoryLabel: 'Kapcsolatok',
    title: 'Ha Anna szerepel a naplódban, másnap többet alszol',
    mechanism: 'Anna említése mellett hosszabb alvás jött ki.',
    evidence: [],
    kind: 'reflection',
    status: 'monitoring',
    testPlan: plan,
    belief: 0.38,
    evidenceHits: 4,
    evidenceMisses: 1,
    ...patch,
  }
}

test('the card carries the eyebrow, the hypothesis question and the human answer', () => {
  render(<HypothesisStateCard pattern={pattern()} pair={pair} onDecide={vi.fn()} />)
  expect(screen.getByText('Kapcsolatok · alvás')).toBeInTheDocument()
  expect(screen.getByText('Anna és az alvásod')).toBeInTheDocument()
  expect(screen.getByText('Hipotézis: Ha Anna szerepel a naplódban, másnap többet alszol?')).toBeInTheDocument()
  // 4 + 1 = 5 bizonyíték-nap, a terv 8-at kér — még gyűlik
  expect(screen.getByText('Ígéretes, de még gyűlik.')).toBeInTheDocument()
})

test.each([
  ['monitoring', 'FIGYELEM'],
  ['proposed', 'GYŰLIK'],
  ['confirmed', 'BEÉPÜLT'],
  ['refuted', 'ELENGEDVE'],
  ['dormant', 'PIHEN'],
  ['rejected', 'ELVETVE'],
] as [PatternRowStatus, string][])('status %s shows the %s pill', (status, pill) => {
  render(<HypothesisStateCard pattern={pattern({ status })} pair={pair} onDecide={vi.fn()} />)
  expect(screen.getByText(pill)).toBeInTheDocument()
})

test.each([
  ['gyűlik', { evidenceHits: 4, evidenceMisses: 1 }, 'Ígéretes, de még gyűlik.'],
  ['tartja', { evidenceHits: 9, evidenceMisses: 2 }, 'Tartja magát.'],
  ['bukik', { evidenceHits: 3, evidenceMisses: 6 }, 'Nem igazolódik.'],
  ['beépült', { evidenceHits: 9, evidenceMisses: 0, status: 'confirmed' as const }, 'Beépült.'],
])('the human answer for %s', (_name, patch, answer) => {
  render(<HypothesisStateCard pattern={pattern(patch)} pair={pair} onDecide={vi.fn()} />)
  expect(screen.getByText(answer)).toBeInTheDocument()
})

test('the sub-line compares the two groups and names the minimum the plan asks for', () => {
  const { container } = render(<HypothesisStateCard pattern={pattern()} pair={pair} onDecide={vi.fn()} />)
  const sub = container.querySelector('.pdt-answer-sub') as HTMLElement
  expect(sub.textContent).toBe('4 ilyen napot tudok összevetni 12 másikkal. 8 napnál mondok többet.')
})

test('the sub-line stays honest without group counts', () => {
  const { container } = render(
    <HypothesisStateCard pattern={pattern()} pair={{ ...pair, groupZeroDays: null, groupOneDays: null }} onDecide={vi.fn()} />,
  )
  const sub = container.querySelector('.pdt-answer-sub') as HTMLElement
  expect(sub.textContent).toBe('5 nap bizonyíték gyűlt eddig. 8 napnál mondok többet.')
})

test('the belief ring shows the percentage as a conic gradient and never a raw statistic', () => {
  const { container } = render(<HypothesisStateCard pattern={pattern()} pair={pair} onDecide={vi.fn()} />)
  const ring = container.querySelector('.pdt-belief-ring') as HTMLElement
  expect(ring.style.getPropertyValue('--v')).toBe('38%')
  expect(screen.getByText('38%')).toBeInTheDocument()
  expect(screen.getByText('bizonyosság')).toBeInTheDocument()
  expect(screen.getByText(/Te bármikor felülírhatod/)).toBeInTheDocument()
  expect(container.textContent).not.toContain('0.31')
})

test('no belief on the row means no ring at all — never an invented number', () => {
  const { container } = render(
    <HypothesisStateCard pattern={pattern({ belief: undefined })} pair={pair} onDecide={vi.fn()} />,
  )
  expect(container.querySelector('.pdt-belief-ring')).toBeNull()
})

test('the three decide buttons report the decision verbs', () => {
  const onDecide = vi.fn()
  render(<HypothesisStateCard pattern={pattern()} pair={pair} onDecide={onDecide} />)
  fireEvent.click(screen.getByRole('button', { name: 'Megerősítem' }))
  fireEvent.click(screen.getByRole('button', { name: 'Figyeljük' }))
  fireEvent.click(screen.getByRole('button', { name: 'Elvetem' }))
  expect(onDecide.mock.calls.map(([status]) => status)).toEqual(['confirm', 'monitor', 'reject'])
})

test.each(['confirmed', 'rejected'] as PatternRowStatus[])('a %s row is a read-only status hero', (status) => {
  render(<HypothesisStateCard pattern={pattern({ status })} pair={pair} onDecide={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Elvetem' })).not.toBeInTheDocument()
})

test('a pairless reflection row still renders — the plan carries the labels', () => {
  render(<HypothesisStateCard pattern={pattern()} pair={null} onDecide={vi.fn()} />)
  expect(screen.getByText('Kapcsolatok · egyéb')).toBeInTheDocument()
  expect(screen.getByText('Ha Anna szerepel a naplódban, másnap többet alszol')).toBeInTheDocument()
})
