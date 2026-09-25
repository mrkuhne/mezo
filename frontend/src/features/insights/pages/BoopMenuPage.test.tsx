import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BoopMenuPage } from '@/features/insights/pages/BoopMenuPage'
import { BOOP_DESTINATIONS } from '@/features/insights/logic/boopNavigation'

it('exposes every original function as a real link without opening another menu', () => {
  render(<MemoryRouter><BoopMenuPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Összes funkció' })).toBeInTheDocument()
  for (const destination of BOOP_DESTINATIONS) {
    expect(screen.getByRole('link', { name: destination.label })).toHaveAttribute('href', destination.to)
  }
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

// Üveg re-dress (U9, mezo-me75u.9): every destination is a glass tile in its wash accent with a
// Titanium 3D icon (never the clay glyph), the Gépterem's own neutral tile in slate.
it('draws each destination as a glass tile with a 3D icon in its accent', () => {
  render(<MemoryRouter><BoopMenuPage /></MemoryRouter>)
  for (const destination of BOOP_DESTINATIONS) {
    const tile = screen.getByRole('link', { name: destination.label })
    expect(tile).toHaveClass('glass')
    expect(tile.querySelector('svg.t-ico')).toBeInTheDocument()
  }
  expect(screen.getByRole('link', { name: 'Gépterem' })).toHaveClass('tf-c-slate')
  expect(screen.getByRole('link', { name: 'Minták' })).toHaveClass('tf-c-lav')
})
