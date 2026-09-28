import { render, screen } from '@testing-library/react'
import { PatternDayPips, PatternLeanMeter } from '@/features/insights/components/PatternLeanMeter'
import { lean } from '@/features/insights/logic/patternReading'

test('the dot sits at the support, the band spans the interval, the matching side is lit', () => {
  render(<PatternLeanMeter now={lean(-0.312, 9, -1)} then={null} side={2} />)
  expect(screen.getByTestId('lean-now').style.getPropertyValue('--x')).toBe('65.6%')
  expect(screen.getByText('Igaz rád')).toHaveClass('on')
  expect(screen.getByRole('img')).toHaveAccessibleName('Merre húz az adat: igaz rád')
  expect(screen.queryByTestId('lean-then')).toBeNull()
})
test('a confirmed row shows where it stood at the decision', () => {
  render(<PatternLeanMeter now={lean(0.27, 16, 1)} then={lean(0.545, 12, 1)} side={2} />)
  expect(screen.getByTestId('lean-then')).toBeInTheDocument()
  expect(screen.getByText('amikor megerősítetted')).toBeInTheDocument()
})
test('the screen-reader label also says where it stood at the decision', () => {
  const { rerender } = render(<PatternLeanMeter now={lean(0.05, 16, 1)} then={lean(0.6, 30, 1)} side={1} />)
  expect(screen.getByRole('img', { name: /^Merre húz/ }))
    .toHaveAccessibleName('Merre húz az adat: nincs hatás. Amikor megerősítetted: igaz rád.')
  rerender(<PatternLeanMeter now={lean(-0.6, 30, 1)} then={lean(0.05, 12, 1)} side={0} />)
  expect(screen.getByRole('img', { name: /^Merre húz/ }))
    .toHaveAccessibleName('Merre húz az adat: épp fordítva. Amikor megerősítetted: nincs hatás.')
})
test('the lit side follows the reading state, not a fixed threshold', () => {
  // support 0.12 sits under the old ±0.15 cut, but a `halvany` reading still leans „igaz rád"
  render(<PatternLeanMeter now={lean(0.12, 40, 1)} then={null} side={2} />)
  expect(screen.getByText('Igaz rád')).toHaveClass('on')
  expect(screen.getByText('Nincs hatás')).not.toHaveClass('on')
})
test('pips light the collected days', () => {
  const { container } = render(<PatternDayPips count={7} of={8} />)
  expect(container.querySelectorAll('.pmx-pips i.on')).toHaveLength(7)
  expect(screen.getByText('még 1 nap')).toBeInTheDocument()
})
