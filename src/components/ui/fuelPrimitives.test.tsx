import { render, screen } from '@testing-library/react'
import { SourceBadge } from './SourceBadge'
import { NovaDot } from './NovaDot'
import { MacroRow } from './MacroRow'
import { StatCell } from './StatCell'

test('SourceBadge shows the source label', () => {
  render(<SourceBadge source="kifli.hu" />)
  expect(screen.getByText('kifli.hu')).toBeInTheDocument()
})
test('NovaDot labels the NOVA group', () => {
  render(<NovaDot nova={3} />)
  expect(screen.getByText('NOVA 3')).toBeInTheDocument()
})
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
