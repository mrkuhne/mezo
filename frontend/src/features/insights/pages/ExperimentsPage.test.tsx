import { render, screen } from '@testing-library/react'
import { ExperimentsPage } from '@/features/insights/pages/ExperimentsPage'

test('renders the count, an active + a completed experiment, and the propose CTA', () => {
  render(<ExperimentsPage />)
  expect(screen.getByText('N=1 kísérletek · 2')).toBeInTheDocument()
  expect(screen.getByText('Glikogén-feltöltés volleyball előtt')).toBeInTheDocument()
  expect(screen.getByText('◐ Aktív')).toBeInTheDocument()
  expect(screen.getByText('✓ Megerősítve')).toBeInTheDocument()
  expect(screen.getByText('Megerősítve · 3/4 mérés')).toBeInTheDocument()
  expect(screen.getByText('+ Új kísérlet javasol Mezo')).toBeInTheDocument()
})
