import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnchorModeView } from '@/features/today/AnchorModeView'

test('renders the anchor header, the three anchors, and the paused note', () => {
  render(<MemoryRouter><AnchorModeView /></MemoryRouter>)
  expect(screen.getByText(/Anchor mode · csendben/)).toBeInTheDocument()
  expect(screen.getByText('Egy pohár víz')).toBeInTheDocument()
  expect(screen.getByText('Egy fehérje-étkezés')).toBeInTheDocument()
  expect(screen.getByText('10 perces sétálás')).toBeInTheDocument()
  expect(screen.getByText(/Heti terv · szünetel/)).toBeInTheDocument()
})
