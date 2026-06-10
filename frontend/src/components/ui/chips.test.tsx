import { render, screen } from '@testing-library/react'
import { Chip } from './Chip'
import { ToolChip } from './ToolChip'
import { ToolChipRow } from './ToolChipRow'
import { RefTag } from './RefTag'

test('Chip applies variant', () => {
  render(<Chip variant="warning">NIGGLE</Chip>)
  expect(screen.getByText('NIGGLE').className).toBe('chip warning notch-4')
})
test('ToolChip applies tool type and shows name', () => {
  render(<ToolChip type="read" name="sleep_db" />)
  const el = screen.getByText(/sleep_db/)
  expect(el.className).toContain('toolchip')
  expect(el.className).toContain('read')
})
test('ToolChip shows args when given', () => {
  render(<ToolChip type="compute" name="calc" args="tdee" />)
  expect(screen.getByText(/\(tdee\)/)).toBeInTheDocument()
})
test('ToolChipRow renders one chip per tool', () => {
  render(<ToolChipRow tools={[{ type: 'read', name: 'a' }, { type: 'write', name: 'b' }]} />)
  expect(screen.getByText(/a/)).toBeInTheDocument()
  expect(screen.getByText(/b/)).toBeInTheDocument()
})
test('RefTag formats [kind] label', () => {
  render(<RefTag kind="ref" label="Alvás" />)
  expect(screen.getByText(/\[ref\]/)).toBeInTheDocument()
  expect(screen.getByText(/Alvás/)).toBeInTheDocument()
})
