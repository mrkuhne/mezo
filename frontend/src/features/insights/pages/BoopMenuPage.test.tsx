import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BoopMenuPage } from '@/features/insights/pages/BoopMenuPage'
import { BOOP_DESTINATIONS } from '@/features/insights/logic/boopNavigation'

it('exposes every original function as a real link without opening another menu', () => {
  render(<MemoryRouter><BoopMenuPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Menü' })).toBeInTheDocument()
  for (const destination of BOOP_DESTINATIONS) {
    expect(screen.getByRole('link', { name: destination.label })).toHaveAttribute('href', destination.to)
  }
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
