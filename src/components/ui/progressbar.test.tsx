import { render } from '@testing-library/react'
import { ProgressBar } from './ProgressBar'

test('clamps value to 0..100 and applies tone fill', () => {
  const { container } = render(<ProgressBar value={150} tone="warning" />)
  const fill = container.querySelector('.bar-fill') as HTMLElement
  expect(fill.className).toContain('warning')
  expect(fill.style.width).toBe('100%')
})
test('negative value clamps to 0', () => {
  const { container } = render(<ProgressBar value={-20} />)
  expect((container.querySelector('.bar-fill') as HTMLElement).style.width).toBe('0%')
})
