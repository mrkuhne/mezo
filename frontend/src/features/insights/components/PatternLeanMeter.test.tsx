import { render, screen } from '@testing-library/react'
import { PatternDayPips, PatternLeanMeter } from '@/features/insights/components/PatternLeanMeter'
import { lean } from '@/features/insights/logic/patternReading'

test('the dot sits at the support, the band spans the interval, the matching side is lit', () => {
  render(<PatternLeanMeter now={lean(-0.312, 9, -1)} then={null} />)
  expect(screen.getByTestId('lean-now').style.getPropertyValue('--x')).toBe('65.6%')
  expect(screen.getByText('Igaz rád')).toHaveClass('on')
  expect(screen.getByRole('img')).toHaveAccessibleName('Merre húz az adat: igaz rád')
  expect(screen.queryByTestId('lean-then')).toBeNull()
})
test('a confirmed row shows where it stood at the decision', () => {
  render(<PatternLeanMeter now={lean(0.27, 16, 1)} then={lean(0.545, 12, 1)} />)
  expect(screen.getByTestId('lean-then')).toBeInTheDocument()
  expect(screen.getByText('amikor megerősítetted')).toBeInTheDocument()
})
test('pips light the collected days', () => {
  const { container } = render(<PatternDayPips count={7} of={8} />)
  expect(container.querySelectorAll('.pmx-pips i.on')).toHaveLength(7)
  expect(screen.getByText('még 1 nap')).toBeInTheDocument()
})
