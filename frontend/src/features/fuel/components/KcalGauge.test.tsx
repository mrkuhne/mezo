import { render, screen } from '@testing-library/react'
import { KcalGauge } from '@/features/fuel/components/KcalGauge'

test('renders consumed, target and percent with a progress arc', () => {
  const { container } = render(<KcalGauge consumed={1840} target={3100} />)
  expect(screen.getByText('1840')).toBeInTheDocument()
  expect(screen.getByText('/ 3100 kcal · 59%')).toBeInTheDocument()
  const arc = container.querySelector('.gauge-p') as SVGPathElement
  expect(arc).not.toBeNull()
  expect(arc.getAttribute('stroke-dasharray')).toMatch(/^167\.8/) // 59.35% of 282.74
})

test('zero day renders 0% without NaN (real-mode cold window)', () => {
  const { container } = render(<KcalGauge consumed={0} target={0} />)
  expect(screen.getByText('0')).toBeInTheDocument()
  expect(screen.getByText('/ 0 kcal · 0%')).toBeInTheDocument()
  expect((container.querySelector('.gauge-p') as SVGPathElement).getAttribute('stroke-dasharray')).toMatch(/^0\.0 /)
})

test('overshoot caps the arc at 100% but shows the real percent', () => {
  const { container } = render(<KcalGauge consumed={3500} target={3000} />)
  expect(screen.getByText(/117%/)).toBeInTheDocument()
  expect((container.querySelector('.gauge-p') as SVGPathElement).getAttribute('stroke-dasharray')).toMatch(/^282\.7/)
})
