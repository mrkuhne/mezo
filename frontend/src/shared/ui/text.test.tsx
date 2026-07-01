import { render, screen } from '@testing-library/react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { LabelMono } from '@/shared/ui/LabelMono'
import { Display } from '@/shared/ui/Display'
import { PageTitle } from '@/shared/ui/PageTitle'

test('Eyebrow renders text and brand modifier', () => {
  const { rerender } = render(<Eyebrow>MA</Eyebrow>)
  expect(screen.getByText('MA').className).toBe('eyebrow')
  rerender(<Eyebrow brand>MA</Eyebrow>)
  expect(screen.getByText('MA').className).toBe('eyebrow brand')
})
test('LabelMono renders', () => {
  render(<LabelMono>SÚLY</LabelMono>)
  expect(screen.getByText('SÚLY').className).toBe('label-mono')
})
test('Display applies size class', () => {
  render(<Display size="xl">42</Display>)
  expect(screen.getByText('42').className).toBe('h-display size-xl')
})
test('PageTitle renders an h1', () => {
  render(<PageTitle>Ma</PageTitle>)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ma')
})
