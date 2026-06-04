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
