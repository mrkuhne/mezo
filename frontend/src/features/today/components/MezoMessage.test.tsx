import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { MezoMessage } from '@/features/today/components/MezoMessage'
import type { Briefing } from '@/data/types'

const briefing: Briefing = {
  eyebrow: 'Mezo · reggeli briefing',
  body: [
    { type: 'p', text: 'Jól aludtál — 7,2 óra.' },
    { type: 'p', text: 'Fehérjéből 84 g van meg.' },
    { type: 'p', text: 'A bal válladra figyelj.' },
  ],
  refs: [{ kind: 'alvás', label: '7,2 óra' }],
  confidence: 0.8,
}

describe('MezoMessage', () => {
  test('every paragraph renders — the message is never clamped', () => {
    render(<MezoMessage briefing={briefing} />)
    expect(screen.getByText(/Jól aludtál/)).toBeInTheDocument()
    expect(screen.getByText(/Fehérjéből 84 g/)).toBeInTheDocument()
    expect(screen.getByText(/bal válladra/)).toBeInTheDocument()
  })

  test('there is no expander — nothing is hidden to expand', () => {
    render(<MezoMessage briefing={briefing} />)
    expect(screen.queryByRole('button', { name: /bővebben|összecsuk/ })).toBeNull()
  })

  test('the avatar circle is gone; the eyebrow carries the identity', () => {
    const { container } = render(<MezoMessage briefing={briefing} />)
    expect(container.querySelector('.cb-avatar')).toBeNull()
    expect(screen.getByText('Mezo · reggeli briefing')).toBeInTheDocument()
  })

  test('the band modifier is on the bubble', () => {
    const { container } = render(<MezoMessage briefing={briefing} />)
    expect(container.querySelector('.coach-bubble.cb-band')).toBeInTheDocument()
  })

  test('refs render; the demo label replaces the fabricated confidence', () => {
    const { unmount } = render(<MezoMessage briefing={briefing} demo />)
    expect(screen.getByText('Hivatkozott')).toBeInTheDocument()
    expect(screen.getByText('Demo tartalom')).toBeInTheDocument()
    unmount()
    render(<MezoMessage briefing={briefing} />)
    expect(screen.getByText('Confidence 80%')).toBeInTheDocument()
  })

  test('an empty refs list renders no refs row', () => {
    const { container } = render(<MezoMessage briefing={{ ...briefing, refs: [] }} />)
    expect(container.querySelector('.brief-refs')).toBeNull()
  })
})
