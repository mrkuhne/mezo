import { render, screen } from '@testing-library/react'
import { StatCell } from '@/shared/ui/StatCell'

test('StatCell shows label, value and sub', () => {
  render(<StatCell label="Receptek" val="6" sub="összesen" />)
  expect(screen.getByText('Receptek')).toBeInTheDocument()
  expect(screen.getByText('6')).toBeInTheDocument()
  expect(screen.getByText('összesen')).toBeInTheDocument()
})
