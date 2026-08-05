import { render, screen, fireEvent } from '@testing-library/react'
import { BriefingCard } from '@/features/today/components/BriefingCard'
import { resolveBriefing } from '@/data/hooks'

test('collapsed by default: shows only the first paragraph and a bővebben button, no refs row', () => {
  const b = resolveBriefing('good') // body contains **bold**
  const { container } = render(<BriefingCard briefing={b} />)
  expect(screen.getByText(/Jó reggelt/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'bővebben' })).toBeInTheDocument()
  expect(container.querySelector('.brief-clamp')).toBeTruthy() // the clamped preview
  expect(container.querySelectorAll('.toolchip').length).toBe(0)
  expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument()
})

test('clicking bővebben expands to the full card: confidence, bold via <strong> (no innerHTML), ref tags, and összecsuk', () => {
  const b = resolveBriefing('good')
  const { container } = render(<BriefingCard briefing={b} />)
  fireEvent.click(screen.getByRole('button', { name: 'bővebben' }))
  expect(screen.getByText(/Confidence/)).toBeInTheDocument()
  expect(container.querySelector('.coach-bubble')).toBeTruthy() // the DS CoachBubble shell
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

test('the bubble eyebrow carries briefing.eyebrow (fallback when empty) and renders no heading', () => {
  const { container } = render(<BriefingCard briefing={{ eyebrow: '', body: [{ type: 'p', text: 'x' }], refs: [] }} />)
  expect(screen.getByText('Mezo · reggeli briefing')).toBeInTheDocument() // empty eyebrow -> fallback
  expect(container.querySelector('h3')).toBeNull()
  expect(container.querySelector('.todaycard')).toBeNull() // no longer an ItemCard re-dress
})

test('expanded: the lead keeps the coach voice, the remaining paragraphs step down to body prose', () => {
  const b = resolveBriefing('medium') // the 3-paragraph base briefing
  const { container } = render(<BriefingCard briefing={b} />)
  fireEvent.click(screen.getByRole('button', { name: 'bővebben' }))
  expect(container.querySelectorAll('.brief-lead')).toHaveLength(1)
  expect(container.querySelectorAll('.brief-rest')).toHaveLength(b.body.length - 1)
})
