import { render, screen } from '@testing-library/react'
import { NotchCard } from '@/components/ui/NotchCard'

test('default card has card + notch-8 classes', () => {
  render(<NotchCard>body</NotchCard>)
  const el = screen.getByText('body')
  expect(el.className).toContain('card')
  expect(el.className).toContain('notch-8')
})
test('glass + notch=12 + accent renders modifiers and the accent strip', () => {
  render(<NotchCard glass notch={12} accent="warning">body</NotchCard>)
  const el = screen.getByText('body')
  expect(el.className).toContain('glass')
  expect(el.className).toContain('notch-12')
  expect(el.querySelector('.accent-strip')).toBeTruthy()
})
