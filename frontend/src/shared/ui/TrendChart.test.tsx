import { render, screen } from '@testing-library/react'
import { TrendChart } from '@/shared/ui/TrendChart'

const SERIES = [
  { name: 'tény', points: [74, 73.6, null, 73.1, 72.9], color: 'var(--dv-sage)', area: true },
  { name: 'terv-pálya', points: [74, 73.5, 73, 72.5, 72], color: 'var(--accent-hover)', dashed: true },
]

test('renders an accessible SVG with one path per series (+ area fill)', () => {
  const { container } = render(<TrendChart series={SERIES} ariaLabel="Testsúly trend, 30 nap" />)
  expect(screen.getByRole('img', { name: 'Testsúly trend, 30 nap' })).toBeInTheDocument()
  // 1 area + 2 line paths
  expect(container.querySelectorAll('svg path')).toHaveLength(3)
  const dashed = container.querySelector('path[stroke-dasharray="4,4"]')
  expect(dashed).not.toBeNull()
})

test('null gaps are skipped, not drawn to zero', () => {
  const { container } = render(
    <TrendChart legend={false} series={[{ name: 'a', points: [1, null, 3], color: 'red' }]} ariaLabel="t" />,
  )
  const d = container.querySelector('path[stroke="red"]')!.getAttribute('d')!
  // two points only → one M + one L
  expect(d.match(/[ML]/g)).toHaveLength(2)
})

test('legend lists every series name', () => {
  render(<TrendChart series={SERIES} ariaLabel="t" />)
  expect(screen.getByText('tény')).toBeInTheDocument()
  expect(screen.getByText('terv-pálya')).toBeInTheDocument()
})
