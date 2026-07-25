import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import { DimensionCard } from '@/features/fuel/components/DimensionCard'
import type { RowsDimension } from '@/data/types'

// A generic rows-dimension (mezo-7797): the WHO dimension renders its label/value
// rows through the (widened) ContextPanel, exactly like the legacy `context` card.
const whoDim: RowsDimension = {
  id: 'who',
  label: 'Ajánlások · WHO',
  weight: 0.14,
  score: 0.9,
  color: 'var(--sky)',
  detail: 'Cukor az energia 6%-a (WHO ≤10%).',
  context: [
    { label: 'Cukor', value: '6 E% / 10 E% limit' },
    { label: 'Só', value: '0.8 g / 1.5 g keret' },
  ],
}

test('renders a RowsDimension: header label, weighted contribution line, and the label/value rows', () => {
  render(<DimensionCard dim={whoDim} />)
  // header (dimension label + weight contribution)
  expect(screen.getByText('Ajánlások · WHO')).toBeInTheDocument()
  expect(screen.getByText(/× súly 14% = 12\.6 pt/)).toBeInTheDocument()
  // the rows panel — each label + value pair renders
  expect(screen.getByText('Cukor')).toBeInTheDocument()
  expect(screen.getByText('6 E% / 10 E% limit')).toBeInTheDocument()
  expect(screen.getByText('Só')).toBeInTheDocument()
  expect(screen.getByText('0.8 g / 1.5 g keret')).toBeInTheDocument()
})
