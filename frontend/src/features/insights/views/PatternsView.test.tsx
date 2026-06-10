import { render, screen } from '@testing-library/react'
import { PatternsView } from './PatternsView'

test('shows the pattern count, the confidence floor and the recently-confirmed list', () => {
  render(<PatternsView />)
  expect(screen.getByText('Új minták · 3')).toBeInTheDocument()
  expect(screen.getByText('min. 65% conf')).toBeInTheDocument()
  expect(screen.getByText('Recently confirmed · L3')).toBeInTheDocument()
  expect(screen.getByText('Hét 18: Pre-workout 2-3h whey + carb')).toBeInTheDocument()
})

test('renders one card per pattern', () => {
  render(<PatternsView />)
  expect(screen.getByText('Reta beadás + 36h ablakban étvágy lefulladás')).toBeInTheDocument()
  expect(screen.getByText('Caffeine 14:00 utáni dózis → sleep onset +24 perc')).toBeInTheDocument()
})
