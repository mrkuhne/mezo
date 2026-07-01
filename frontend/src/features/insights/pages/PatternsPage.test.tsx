import { render, screen } from '@testing-library/react'
import { PatternsPage } from '@/features/insights/pages/PatternsPage'

test('shows the pattern count, the confidence floor and the recently-confirmed list', () => {
  render(<PatternsPage />)
  expect(screen.getByText('Új minták · 3')).toBeInTheDocument()
  expect(screen.getByText('min. 65% conf')).toBeInTheDocument()
  expect(screen.getByText('Recently confirmed · L3')).toBeInTheDocument()
  expect(screen.getByText('Hét 18: Pre-workout 2-3h whey + carb')).toBeInTheDocument()
})

test('renders one card per pattern', () => {
  render(<PatternsPage />)
  expect(screen.getByText('Reta beadás + 36h ablakban étvágy lefulladás')).toBeInTheDocument()
  expect(screen.getByText('Caffeine 14:00 utáni dózis → sleep onset +24 perc')).toBeInTheDocument()
})
