import { render } from '@testing-library/react'
import { Icon, BrandGlyph } from '@/components/ui/Icon'

test('renders an svg for a known icon name', () => {
  const { container } = render(<Icon name="today" />)
  expect(container.querySelector('svg')).toBeTruthy()
})
test('applies the size prop to width/height', () => {
  const { container } = render(<Icon name="mic" size={10} />)
  const svg = container.querySelector('svg')!
  expect(svg.getAttribute('width')).toBe('10')
  expect(svg.getAttribute('height')).toBe('10')
})
test('BrandGlyph renders an svg', () => {
  const { container } = render(<BrandGlyph />)
  expect(container.querySelector('svg')).toBeTruthy()
})
