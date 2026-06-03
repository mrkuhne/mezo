import { render, screen } from '@testing-library/react'
import { BriefingCard } from './BriefingCard'
import { resolveBriefing } from '@/data/hooks'

test('renders eyebrow, confidence, bold via <strong> (no innerHTML), and ref tags', () => {
  const b = resolveBriefing('good') // body contains **bold**
  const { container } = render(<BriefingCard briefing={b} />)
  expect(screen.getByText(/Confidence/)).toBeInTheDocument()
  expect(container.querySelector('.accent-strip')).toBeTruthy()
  expect(container.querySelector('.briefing-body strong')).toBeTruthy()
  expect(container.querySelectorAll('.toolchip').length).toBeGreaterThan(0)
})
