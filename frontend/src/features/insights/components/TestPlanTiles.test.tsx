import { render, screen } from '@testing-library/react'
import { TestPlanTiles } from '@/features/insights/components/TestPlanTiles'
import type { PatternMonitorPair, PatternTestPlan } from '@/data/types'

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

const pair = {
  metricAValueKind: 'binary',
  metricADomain: 'mind',
  metricBValueKind: 'number',
  metricBDomain: 'sleep',
} as PatternMonitorPair

test('the two tiles spell out the if/then halves of the pre-registered plan', () => {
  const { container } = render(<TestPlanTiles plan={plan} pair={pair} />)
  expect(screen.getByText('Ha…')).toBeInTheDocument()
  expect(screen.getByText('…akkor')).toBeInTheDocument()
  expect(screen.getByText('„Anna” a szövegeidben')).toBeInTheDocument()
  expect(screen.getByText('alváshossz')).toBeInTheDocument()
  // clay ikonok a két sorozat doménjéből — sosem emoji
  expect(container.querySelector('.pdt-plan-tile-a use')).toHaveAttribute('href', '#i-naplo')
  expect(container.querySelector('.pdt-plan-tile-b use')).toHaveAttribute('href', '#i-alvas')
})

test('the strip carries the four pre-registered numbers of the plan', () => {
  const { container } = render(<TestPlanTiles plan={plan} pair={pair} />)
  const strip = container.querySelector('.pdt-plan-strip') as HTMLElement
  expect([...strip.children].map((cell) => cell.textContent)).toEqual([
    '+1 napeltolás',
    '8 napkell minimum',
    'többvárt irány',
    '60 napablak',
  ])
})

test('a negative expected direction reads as the opposite word', () => {
  const { container } = render(
    <TestPlanTiles plan={{ ...plan, expectedDirection: 'negative', lagDays: 0 }} pair={pair} />,
  )
  const strip = container.querySelector('.pdt-plan-strip') as HTMLElement
  expect(strip.textContent).toContain('kevesebb')
  expect(strip.textContent).toContain('+0 nap')
})

test('the binary series says it is a daily yes/no, the numeric one a daily value', () => {
  render(<TestPlanTiles plan={plan} pair={pair} />)
  expect(screen.getByText('napi jel · 0 / 1')).toBeInTheDocument()
  expect(screen.getByText('napi érték')).toBeInTheDocument()
})
