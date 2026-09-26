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
  // 3D sprite ikonok a két sorozat doménjéből — sosem emoji (mezo-me75u.13)
  expect(container.querySelector('.pdt-plan-tile-a use')).toHaveAttribute('href', '#t-journal')
  expect(container.querySelector('.pdt-plan-tile-b use')).toHaveAttribute('href', '#t-moon')
})

test('the strip carries the four pre-registered numbers of the plan', () => {
  const { container } = render(<TestPlanTiles plan={plan} pair={pair} />)
  const strip = container.querySelector('.pdt-plan-strip') as HTMLElement
  expect([...strip.children].map((cell) => cell.textContent)).toEqual([
    'másnapnézem a hatást',
    '8 napkell a döntéshez',
    'többamit várok',
    '60 napennyit nézek vissza',
  ])
})

test('a negative expected direction reads as the opposite word', () => {
  const { container } = render(
    <TestPlanTiles plan={{ ...plan, expectedDirection: 'negative', lagDays: 0 }} pair={pair} />,
  )
  const strip = container.querySelector('.pdt-plan-strip') as HTMLElement
  expect(strip.textContent).toContain('kevesebb')
  expect(strip.textContent).toContain('aznap')
})

test('the binary series says it is a daily yes/no, the numeric one a daily value', () => {
  render(<TestPlanTiles plan={plan} pair={pair} />)
  expect(screen.getByText('megtörtént-e aznap')).toBeInTheDocument()
  expect(screen.getByText('mennyi volt aznap')).toBeInTheDocument()
})

test('no arrow glyph sits between the two halves (mezo-0469)', () => {
  const { container } = render(<TestPlanTiles plan={plan} pair={pair} />)
  expect(container.textContent).not.toMatch(/[→↔]/)
})
