import { render, screen } from '@testing-library/react'
import { FuelTimelinePreview } from './FuelTimelinePreview'

test('shows the fuel header and a MOST chip on the active slot', () => {
  render(<FuelTimelinePreview />)
  expect(screen.getByText('Mai fuel · timeline')).toBeInTheDocument()
  expect(screen.getByText('MOST')).toBeInTheDocument()
})
