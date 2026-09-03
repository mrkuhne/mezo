import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

test('collapsed header shows label, ring score, weight→pont line; the rows appear after expanding (mezo-zeeq)', async () => {
  render(<DimensionCard dim={whoDim} />)
  const head = screen.getByRole('button', { name: /Ajánlások · WHO/ })
  expect(head).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText('90')).toBeInTheDocument()
  expect(screen.getByText(/súly/)).toHaveTextContent('súly 14% → 12,6 pont')
  expect(screen.queryByText('6 E% / 10 E% limit')).not.toBeInTheDocument()
  await userEvent.click(head)
  expect(head).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('Cukor')).toBeInTheDocument()
  expect(screen.getByText('6 E% / 10 E% limit')).toBeInTheDocument()
  expect(screen.getByText('Só')).toBeInTheDocument()
  expect(screen.getByText('0.8 g / 1.5 g keret')).toBeInTheDocument()
})

test('renders dim.note below the detail sentence once expanded, and nothing when note is absent (mezo-jcpt.1)', async () => {
  render(<DimensionCard dim={whoDim} defaultOpen />)
  expect(screen.queryByText('Só szinte nincs — feldolgozatlan alapanyagok.')).not.toBeInTheDocument()

  const noted: RowsDimension = { ...whoDim, note: 'Só szinte nincs — feldolgozatlan alapanyagok.' }
  render(<DimensionCard dim={noted} defaultOpen />)
  expect(screen.getByText('Só szinte nincs — feldolgozatlan alapanyagok.')).toBeInTheDocument()
})

test('a degraded (weight 0, no per-kind payload) dimension renders without crashing and shows no panel (mezo-jcpt.1)', async () => {
  // Shape a real fromDimension/fromBreakdown now produces for a degraded dim: base fields only,
  // no macroRatio/micros/nova/context — DimensionCard must not assume any of those exist.
  const degraded = {
    id: 'who', label: 'Ajánlások · WHO', weight: 0, score: 0, color: 'var(--sky)',
    detail: 'Nincs elég adat ehhez a dimenzióhoz.',
  } as RowsDimension
  render(<DimensionCard dim={degraded} defaultOpen />)
  expect(screen.getByText('Ajánlások · WHO')).toBeInTheDocument()
  expect(screen.getByText('Nincs elég adat ehhez a dimenzióhoz.')).toBeInTheDocument()
  expect(screen.getByText(/súly/)).toHaveTextContent('súly 0% → 0 pont')
  // no ContextPanel rows (it has no `context` payload to render)
  expect(screen.queryByText('Cukor')).not.toBeInTheDocument()
})
