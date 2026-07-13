import { render, screen, fireEvent } from '@testing-library/react'
import { BriefingCard } from '@/features/today/components/BriefingCard'
import { resolveBriefing } from '@/data/hooks'

test('collapsed by default: shows only the first paragraph and a bővebben button, no refs row', () => {
  const b = resolveBriefing('good') // body contains **bold**
  const { container } = render(<BriefingCard briefing={b} />)
  expect(screen.getByText(/Jó reggelt/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'bővebben' })).toBeInTheDocument()
  expect(container.querySelectorAll('.toolchip').length).toBe(0)
  expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument()
})

test('clicking bővebben expands to the full card: confidence, bold via <strong> (no innerHTML), ref tags, and összecsuk', () => {
  const b = resolveBriefing('good')
  const { container } = render(<BriefingCard briefing={b} />)
  fireEvent.click(screen.getByRole('button', { name: 'bővebben' }))
  expect(screen.getByText(/Confidence/)).toBeInTheDocument()
  expect(container.querySelector('.accent-strip')).toBeTruthy()
  expect(container.querySelector('.briefing-body strong')).toBeTruthy()
  expect(container.querySelectorAll('.toolchip').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'összecsuk' })).toBeInTheDocument()
})

test('expanded: generated briefing with no demo label and no confidence chip', () => {
  const generated = {
    eyebrow: 'Reggeli briefing · Reta nap 3',
    body: [{ type: 'p' as const, text: 'Jól aludtál.' }],
    refs: [{ kind: 'Sleep', label: 'regeneráció' }],
  }
  render(<BriefingCard briefing={generated} demo={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'bővebben' }))
  expect(screen.getByText('Reggeli briefing · Reta nap 3')).toBeInTheDocument()
  expect(screen.queryByText('Demo tartalom')).not.toBeInTheDocument()
  expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument()
  expect(screen.getByText(/regeneráció/)).toBeInTheDocument()
})
