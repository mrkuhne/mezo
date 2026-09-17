import { render, screen } from '@testing-library/react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'

test('Eyebrow renders text and brand modifier', () => {
  const { rerender } = render(<Eyebrow>MA</Eyebrow>)
  expect(screen.getByText('MA').className).toBe('eyebrow')
  rerender(<Eyebrow brand>MA</Eyebrow>)
  expect(screen.getByText('MA').className).toBe('eyebrow brand')
})
test('Display applies size class', () => {
  render(<Display size="xl">42</Display>)
  expect(screen.getByText('42').className).toBe('h-display size-xl')
})
