import { render, screen } from '@testing-library/react'
import { BriefingCard } from '@/features/today/components/BriefingCard'
import { resolveBriefing } from '@/data/hooks'

test('renders eyebrow, confidence, bold via <strong> (no innerHTML), and ref tags', () => {
  const b = resolveBriefing('good') // body contains **bold**
  const { container } = render(<BriefingCard briefing={b} />)
  expect(screen.getByText(/Confidence/)).toBeInTheDocument()
  expect(container.querySelector('.accent-strip')).toBeTruthy()
  expect(container.querySelector('.briefing-body strong')).toBeTruthy()
  expect(container.querySelectorAll('.toolchip').length).toBeGreaterThan(0)
})

test('renders a generated briefing with no demo label and no confidence chip', () => {
  const generated = {
    eyebrow: 'Reggeli briefing · Reta nap 3',
    body: [{ type: 'p' as const, text: 'Jól aludtál.' }],
    refs: [{ kind: 'Sleep', label: 'regeneráció' }],
  }
  render(<BriefingCard briefing={generated} demo={false} />)
  expect(screen.getByText('Reggeli briefing · Reta nap 3')).toBeInTheDocument()
  expect(screen.queryByText('Demo tartalom')).not.toBeInTheDocument()
  expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument()
  expect(screen.getByText(/regeneráció/)).toBeInTheDocument()
})
