import { render, screen } from '@testing-library/react'
import { WeeklyView } from '@/features/insights/views/WeeklyView'

test('renders the score hero, the delta, every item and the plan suggestion', () => {
  render(<WeeklyView />)
  expect(screen.getByText('Hét 21 áttekintés · Máj 18-24')).toBeInTheDocument()
  expect(screen.getByText('82')).toBeInTheDocument()
  expect(screen.getByText('+4')).toBeInTheDocument()
  expect(screen.getByText('Edzés volumen')).toBeInTheDocument()
  expect(screen.getByText('Niggle-mentes napok')).toBeInTheDocument()
  expect(screen.getByText('Mezo · heti tervjavaslat')).toBeInTheDocument()
  expect(screen.getByText(/Hét 22: tartsd ezt a Pull\/Push/)).toBeInTheDocument()
})
