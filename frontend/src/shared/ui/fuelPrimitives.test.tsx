import { render, screen } from '@testing-library/react'
import { MacroRow } from '@/shared/ui/MacroRow'
import { StatCell } from '@/shared/ui/StatCell'

test('MacroRow renders kcal/P/C/F', () => {
  render(<MacroRow macros={{ kcal: 420, p: 30, c: 50, f: 10 }} />)
  expect(screen.getByText(/420/)).toBeInTheDocument()
  expect(screen.getByText(/30/)).toBeInTheDocument()
})
test('StatCell shows label, value and sub', () => {
  render(<StatCell label="Receptek" val="6" sub="összesen" />)
  expect(screen.getByText('Receptek')).toBeInTheDocument()
  expect(screen.getByText('6')).toBeInTheDocument()
  expect(screen.getByText('összesen')).toBeInTheDocument()
})
