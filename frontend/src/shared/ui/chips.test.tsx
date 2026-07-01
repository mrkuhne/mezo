import { render, screen } from '@testing-library/react'
import { Chip } from '@/shared/ui/Chip'
import { ToolChip } from '@/shared/ui/ToolChip'
import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import { RefTag } from '@/shared/ui/RefTag'

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
