import { render, screen, fireEvent } from '@testing-library/react'
import { BriefingCard } from '@/features/today/components/BriefingCard'
import { resolveBriefing } from '@/data/hooks'

test('collapsed by default: shows only the first paragraph and a bővebben button, no refs row', () => {
  const b = resolveBriefing('good') // body contains **bold**
  const { container } = render(<BriefingCard briefing={b} />)
  expect(screen.getByText(/Jó reggelt/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'bővebben' })).toBeInTheDocument()
  expect(container.querySelector('.brief-clamp')).toBeTruthy() // the two-line clamp
  expect(container.querySelectorAll('.toolchip').length).toBe(0)
  expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument()
})

test('clicking bővebben expands to the full card: confidence, bold via <strong> (no innerHTML), ref tags, and összecsuk', () => {
  const b = resolveBriefing('good')
  const { container } = render(<BriefingCard briefing={b} />)
  fireEvent.click(screen.getByRole('button', { name: 'bővebben' }))
  expect(screen.getByText(/Confidence/)).toBeInTheDocument()
  expect(container.querySelector('.todaycard.todaycard-mind')).toBeTruthy() // the shared ItemCard shell
  expect(container.querySelector('.briefing-body strong')).toBeTruthy()
  expect(container.querySelectorAll('.toolchip').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'összecsuk' })).toBeInTheDocument()
})

test('összecsuk collapses the expanded card back to the clamped preview', () => {
  const b = resolveBriefing('good')
  const { container } = render(<BriefingCard briefing={b} />)
  fireEvent.click(screen.getByRole('button', { name: 'bővebben' }))
  expect(screen.getByRole('button', { name: 'összecsuk' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'összecsuk' }))
  // Back to the collapsed state: bővebben returns, the refs row and confidence chip are gone.
  expect(screen.getByRole('button', { name: 'bővebben' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'összecsuk' })).not.toBeInTheDocument()
  expect(container.querySelector('.brief-clamp')).toBeTruthy()
  expect(container.querySelectorAll('.toolchip').length).toBe(0)
  expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument()
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

test('demo mode replaces the fabricated confidence % with the honest „Demo tartalom" label', () => {
  const b = resolveBriefing('good')
  render(<BriefingCard briefing={b} demo />)
  fireEvent.click(screen.getByRole('button', { name: 'bővebben' }))
  expect(screen.getByText('Demo tartalom')).toBeInTheDocument()
  expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument()
})

test('the eyebrow tag carries briefing.eyebrow, and the card renders NO heading (its prose is the body)', () => {
  const { container } = render(<BriefingCard briefing={{ eyebrow: '', body: [{ type: 'p', text: 'x' }], refs: [] }} />)
  expect(screen.getByText('Mezo · reggeli briefing')).toBeInTheDocument() // empty eyebrow -> fallback
  expect(container.querySelector('.todaycard-title')).toBeNull()
})

test('caller-supplied facts render as metapills; none by default', () => {
  const b = resolveBriefing('good')
  const { container, rerender } = render(<BriefingCard briefing={b} />)
  expect(container.querySelectorAll('.metapill')).toHaveLength(0)
  rerender(<BriefingCard briefing={b} facts={['alvás 7.2h', null, 'súly 78.6']} />)
  expect(container.querySelectorAll('.metapill')).toHaveLength(2)
  expect(screen.getByText('alvás 7.2h')).toBeInTheDocument()
})
