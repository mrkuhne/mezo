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
  // erős, a terv irányába mutató mai olvasat — a „van mit megerősíteni" alapeset (mezo-a80d0)
  r: 0.52,
  n: 16,
  p: 0.04,
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

test('a catalog pair shows its question, never the arrow title (mezo-0469)', () => {
  const catalog = { ...pair, title: 'Esti lezárás ↔ rákövetkező alvásminőség',
    questionHu: 'Jobban alszol, ha este lezárod a napot?',
    mechanismHu: 'Az esti lezárás lecsendesítheti az elalvást — jobb alvásminőség.' }
  const { container } = render(<HypothesisStateCard pattern={pattern()} pair={catalog} dayCount={16} plan={plan} onDecide={vi.fn()} />)
  expect(screen.getByText('Jobban alszol, ha este lezárod a napot?')).toBeInTheDocument()
  expect(screen.getByText('Az esti lezárás lecsendesítheti az elalvást — jobb alvásminőség.')).toBeInTheDocument()
  expect(container.textContent).not.toContain('↔')
})

test('the card carries the eyebrow, the hypothesis question and the human answer', () => {
  render(<HypothesisStateCard pattern={pattern()} pair={pair} dayCount={16} plan={plan} onDecide={vi.fn()} />)
  expect(screen.getByText('Kapcsolatok · alvás')).toBeInTheDocument()
  // a cím a hipotézis kérdése, alatta a miértje — belső párcím / „Hipotézis:" előtag nincs (mezo-0469)
  expect(screen.getByText('Ha Anna szerepel a naplódban, másnap többet alszol?')).toBeInTheDocument()
  expect(screen.getByText('Anna említése mellett hosszabb alvás jött ki.')).toBeInTheDocument()
  expect(screen.queryByText(/Hipotézis:/)).not.toBeInTheDocument()
  // a grafikon 16 napja ≥ a terv 8-as minimuma — a döntéshez már elég
  expect(screen.getByText('Ígéretes — elég nap van a döntéshez.')).toBeInTheDocument()
})

// 3 nap < a terv 8-as minimuma — a `proposed` sor itt még GYŰLIK (a DÖNTHETSZ-ágat külön teszt fedi)
test.each([
  ['monitoring', 'FIGYELEM'],
  ['proposed', 'GYŰLIK'],
  ['confirmed', 'BEÉPÜLT'],
  ['refuted', 'ELENGEDVE'],
  ['dormant', 'PIHEN'],
  ['rejected', 'ELVETVE'],
] as [PatternRowStatus, string][])('status %s shows the %s pill', (status, pill) => {
  render(<HypothesisStateCard pattern={pattern({ status })} pair={pair} dayCount={3} plan={plan} onDecide={vi.fn()} />)
  expect(screen.getByText(pill)).toBeInTheDocument()
})

test.each([
  ['elég nap, a figyelés még az elején', { evidenceHits: 4, evidenceMisses: 1 }, 'Ígéretes — elég nap van a döntéshez.'],
  ['tartja', { evidenceHits: 9, evidenceMisses: 2 }, 'Tartja magát.'],
  ['bukik', { evidenceHits: 3, evidenceMisses: 6 }, 'Nem igazolódik.'],
  ['beépült', { evidenceHits: 9, evidenceMisses: 0, status: 'confirmed' as const }, 'Beépült.'],
])('the human answer for %s', (_name, patch, answer) => {
  render(<HypothesisStateCard pattern={pattern(patch)} pair={pair} dayCount={16} plan={plan} onDecide={vi.fn()} />)
  expect(screen.getByText(answer)).toBeInTheDocument()
})

test('the sub-line compares the two groups and names the minimum the plan asks for', () => {
  const { container } = render(<HypothesisStateCard pattern={pattern()} pair={pair} dayCount={16} plan={plan} onDecide={vi.fn()} />)
  const sub = container.querySelector('.pdt-answer-sub') as HTMLElement
  expect(sub.textContent).toBe('4 ilyen napot tudok összevetni 12 másikkal — elég ahhoz, hogy dönts.')
})

test('the sub-line stays honest without group counts', () => {
  const { container } = render(
    <HypothesisStateCard pattern={pattern()} pair={{ ...pair, groupZeroDays: null, groupOneDays: null }} dayCount={5} plan={plan} onDecide={vi.fn()} />,
  )
  const sub = container.querySelector('.pdt-answer-sub') as HTMLElement
  expect(sub.textContent).toBe('5 napot tudok összevetni. 8 napnál mondok többet.')
  expect(screen.getByText('Ígéretes, de még gyűlik.')).toBeInTheDocument()
})

// A tulajdonos esete (mezo-twizx): a javasolt minta figyelő-mérlege még üres (0 + 0), de a
// grafikon 8 napot rajzol ki — a kártya a grafikon napjait mondja, sosem a nullát.
test('a proposed row with an empty tally shows the days the chart plots, never 0', () => {
  const { container } = render(
    <HypothesisStateCard
      pattern={pattern({ status: 'proposed', evidenceHits: 0, evidenceMisses: 0 })}
      pair={{ ...pair, metricAValueKind: 'number', groupZeroDays: null, groupOneDays: null }}
      dayCount={8} plan={plan} onDecide={vi.fn()} />,
  )
  const sub = container.querySelector('.pdt-answer-sub') as HTMLElement
  expect(sub.textContent).toBe('8 napot tudok összevetni — elég ahhoz, hogy dönts.')
  expect(sub.textContent).not.toMatch(/\b0 nap/)
  expect(screen.getByText('Ígéretes — elég nap van a döntéshez.')).toBeInTheDocument()
  expect(screen.getByText('DÖNTHETSZ')).toBeInTheDocument()
  expect(screen.queryByText('GYŰLIK')).not.toBeInTheDocument()
})

test('a proposed row below the plan minimum still says it is collecting', () => {
  const { container } = render(
    <HypothesisStateCard
      pattern={pattern({ status: 'proposed', evidenceHits: 0, evidenceMisses: 0 })}
      pair={{ ...pair, metricAValueKind: 'number', groupZeroDays: null, groupOneDays: null }}
      dayCount={3} plan={plan} onDecide={vi.fn()} />,
  )
  const sub = container.querySelector('.pdt-answer-sub') as HTMLElement
  expect(sub.textContent).toBe('3 napot tudok összevetni. 8 napnál mondok többet.')
  expect(screen.getByText('Ígéretes, de még gyűlik.')).toBeInTheDocument()
  expect(screen.getByText('GYŰLIK')).toBeInTheDocument()
})

test('the belief strip shows the percentage as a flat cell inside the glass hero, never a raw statistic', () => {
  const { container } = render(<HypothesisStateCard pattern={pattern()} pair={pair} dayCount={16} plan={plan} onDecide={vi.fn()} />)
  const strip = container.querySelector('.pdt-belief') as HTMLElement
  expect(strip.style.getPropertyValue('--v')).toBe('38%')
  // never glass inside glass (bible U1 rule 5): the hero is the one glass surface
  expect(strip.closest('.glass')).toHaveClass('pdt-hero')
  expect(strip).not.toHaveClass('glass')
  expect(screen.getByText('38%')).toBeInTheDocument()
  expect(screen.getByText('bizonyosság')).toBeInTheDocument()
  expect(screen.getByText(/Te bármikor felülírhatod/)).toBeInTheDocument()
  expect(container.textContent).not.toContain('0.52')
})

test('no belief on the row means no ring at all — never an invented number', () => {
  const { container } = render(
    <HypothesisStateCard pattern={pattern({ belief: undefined })} pair={pair} dayCount={16} plan={plan} onDecide={vi.fn()} />,
  )
  expect(container.querySelector('.pdt-belief')).toBeNull()
})

// Üvegesítés U8a (mezo-me75u.13): the day ring and the answer read the SAME count (mezo-twizx).
test('the day ring shows the plotted days over the plan minimum, gold once there are enough', () => {
  const { container, rerender } = render(
    <HypothesisStateCard pattern={pattern({ status: 'proposed' })} pair={pair} dayCount={5} plan={plan} onDecide={vi.fn()} />,
  )
  expect(screen.getByRole('img', { name: '5 nap a terv 8 napos minimumából' })).toHaveClass('pdt-tone-lav')
  expect(container.querySelector('.pdt-ring-n')?.textContent).toBe('5/8')
  rerender(<HypothesisStateCard pattern={pattern({ status: 'proposed' })} pair={pair} dayCount={8} plan={plan} onDecide={vi.fn()} />)
  expect(screen.getByRole('img', { name: '8 nap a terv 8 napos minimumából' })).toHaveClass('pdt-tone-gold')
  expect(container.querySelector('.pdt-ring-n')?.textContent).toBe('8/8')
  // past the minimum the ring just counts
  rerender(<HypothesisStateCard pattern={pattern({ status: 'proposed' })} pair={pair} dayCount={16} plan={plan} onDecide={vi.fn()} />)
  expect(container.querySelector('.pdt-ring-n')?.textContent).toBe('16')
})

test('decidable rows carry the three decisions with the one-line explanation; judged rows none', () => {
  const { container, rerender } = render(
    <HypothesisStateCard pattern={pattern({ status: 'monitoring' })} pair={pair} dayCount={16} plan={plan} onDecide={vi.fn()} />,
  )
  expect(screen.getByRole('group', { name: 'Döntés a mintáról' })).toBeInTheDocument()
  expect(container.querySelector('.pdt-decnote')?.textContent).toContain('befagy, többé nem hozom elő')
  rerender(<HypothesisStateCard pattern={pattern({ status: 'confirmed' })} pair={pair} dayCount={16} plan={plan} onDecide={vi.fn()} />)
  expect(screen.queryByRole('group', { name: 'Döntés a mintáról' })).not.toBeInTheDocument()
  expect(container.querySelector('.pdt-decnote')).toBeNull()
})

test('the three decide buttons report the decision verbs', () => {
  const onDecide = vi.fn()
  render(<HypothesisStateCard pattern={pattern()} pair={pair} dayCount={16} plan={plan} onDecide={onDecide} />)
  fireEvent.click(screen.getByRole('button', { name: 'Megerősítem' }))
  fireEvent.click(screen.getByRole('button', { name: 'Figyeljük' }))
  fireEvent.click(screen.getByRole('button', { name: 'Elvetem' }))
  expect(onDecide.mock.calls.map(([status]) => status)).toEqual(['confirm', 'monitor', 'reject'])
})

test.each(['confirmed', 'rejected'] as PatternRowStatus[])('a %s row is a read-only status hero', (status) => {
  render(<HypothesisStateCard pattern={pattern({ status })} pair={pair} dayCount={16} plan={plan} onDecide={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Elvetem' })).not.toBeInTheDocument()
})

// mezo-a80d0 — a tulajdonos esete: késői étkezés ↔ alvás, r=-0.02, p=0.955, 14 nap, javasolt.
// A kártya régen „Ígéretes — DÖNTHETSZ"-et mondott rá, mert csak a napokat nézte, az eredményt nem.
describe('a live reading with no relationship (mezo-a80d0)', () => {
  const nullPair = { ...pair, metricAValueKind: 'number' as const, groupZeroDays: null, groupOneDays: null,
    r: -0.02, p: 0.955 }
  const proposed = pattern({ status: 'proposed', evidenceHits: 0, evidenceMisses: 0, belief: undefined })

  test('says there is no relationship, never "promising", and drops the decide pill', () => {
    render(<HypothesisStateCard pattern={proposed} pair={nullPair} dayCount={14} plan={plan} onDecide={vi.fn()} />)
    expect(screen.getByText('Egyelőre nincs összefüggés.')).toBeInTheDocument()
    expect(screen.queryByText(/Ígéretes/)).not.toBeInTheDocument()
    expect(screen.getByText('NINCS JEL')).toBeInTheDocument()
    expect(screen.queryByText('DÖNTHETSZ')).not.toBeInTheDocument()
  })

  test('offers only watch and reject — there is nothing to confirm', () => {
    const { container } = render(
      <HypothesisStateCard pattern={proposed} pair={nullPair} dayCount={14} plan={plan} onDecide={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Figyeljük' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elvetem' })).toBeInTheDocument()
    expect(container.querySelector('.pdt-decnote')?.textContent).toContain('nincs mit megerősíteni')
  })

  test('a strong reading pointing AGAINST the plan is no support either', () => {
    render(<HypothesisStateCard pattern={proposed} pair={{ ...nullPair, r: -0.6, p: 0.01 }}
      dayCount={14} plan={plan} onDecide={vi.fn()} />)
    expect(screen.getByText('Egyelőre nincs összefüggés.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
  })

  test('once the nightly tally is long enough, it rules: mostly misses reads "Nem igazolódik"', () => {
    render(<HypothesisStateCard pattern={pattern({ status: 'proposed', evidenceHits: 0, evidenceMisses: 18 })}
      pair={nullPair} dayCount={14} plan={plan} onDecide={vi.fn()} />)
    expect(screen.getByText('Nem igazolódik.')).toBeInTheDocument()
    expect(screen.getByText('NINCS JEL')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
  })

  test('without a live reading the card claims nothing about today', () => {
    render(<HypothesisStateCard pattern={proposed} pair={{ ...nullPair, r: null, p: null }}
      dayCount={14} plan={plan} onDecide={vi.fn()} />)
    expect(screen.getByText('Ígéretes — elég nap van a döntéshez.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Megerősítem' })).toBeInTheDocument()
  })
})
