import { render, screen } from '@testing-library/react'
import { ScoreRing } from './ScoreRing'

test('renders the centered label when provided', () => {
  render(<ScoreRing pct={0.92} size={96} label="92" />)
  expect(screen.getByText('92')).toBeInTheDocument()
})
test('renders two circles (track + arc)', () => {
  const { container } = render(<ScoreRing pct={0.5} size={56} />)
  expect(container.querySelectorAll('circle')).toHaveLength(2)
})
test('renders a sublabel and applies labelColor when provided', () => {
  const { getByText } = render(<ScoreRing pct={0.92} size={96} label="92" labelColor="var(--brand-glow)" sublabel="/100" />)
  expect(getByText('92')).toBeInTheDocument()
  expect(getByText('/100')).toBeInTheDocument()
})
