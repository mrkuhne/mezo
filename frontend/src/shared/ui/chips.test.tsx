import { render, screen } from '@testing-library/react'
import { ToolChip } from '@/shared/ui/ToolChip'
import { RefTag, refKind3D } from '@/shared/ui/RefTag'

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
test('RefTag formats [kind] label', () => {
  render(<RefTag kind="ref" label="Alvás" />)
  expect(screen.getByText(/\[ref\]/)).toBeInTheDocument()
  expect(screen.getByText(/Alvás/)).toBeInTheDocument()
})

test('RefTag glass: the kind becomes a 3D icon + sr-only word, no bracket text (üveg, mezo-me75u.8)', () => {
  const { container } = render(<RefTag glass kind="Sleep" label="5,7 h" />)
  expect(screen.queryByText(/\[Sleep\]/)).toBeNull()
  expect(screen.getByText('5,7 h')).toBeInTheDocument()
  expect(container.querySelector('.reftag-3d use')?.getAttribute('href')).toBe('#t-sleep')
  expect(container.querySelector('.reftag-3d .sr-only')?.textContent).toBe('alvás: ')
  // an unknown kind falls back to the anchor, with no invented word
  const { container: c2 } = render(<RefTag glass kind="Whatever" label="x" />)
  expect(c2.querySelector('.reftag-3d use')?.getAttribute('href')).toBe('#t-anchor')
  expect(c2.querySelector('.reftag-3d .sr-only')).toBeNull()
})

test('refKind3D: Effect ref kind resolves to the chain icon + "hatás" (mezo-d6ivw.5)', () => {
  expect(refKind3D('Effect')).toEqual(['t-chain', 'hatás'])
  // unknown kind fallback is unaffected
  expect(refKind3D('Whatever')).toEqual(['t-anchor', null])
})
