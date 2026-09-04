import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { test, expect } from 'vitest'
import { DimensionCard } from '@/features/fuel/components/DimensionCard'
import type { ContextDimension, RowsDimension } from '@/data/types'

function renderOpen(dim: ContextDimension | RowsDimension) {
  return render(<DimensionCard dim={dim} defaultOpen />)
}

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

// Az időzítés-sáv (mezo-jcpt.3): kizárólag a logolt étkezés `context` dimenzióján jelenik meg.
const contextDimWithTiming: ContextDimension = {
  id: 'context',
  label: 'Időzítés & kontextus',
  weight: 0.2,
  score: 0.9,
  color: 'var(--cat-preference)',
  detail: '19:00 · vacsora ablakban.',
  context: [{ label: 'Időzítés', value: '19:00 · vacsora ablakban' }],
  timing: { eatenAt: '19:00', windowFrom: '17:00', windowTo: '22:00', slotLabel: 'vacsora' },
}

const contextDimWithoutTiming: ContextDimension = {
  ...contextDimWithTiming,
  timing: undefined,
}

const portionDim: RowsDimension = {
  id: 'portion',
  label: 'Adag-arány',
  weight: 0.1,
  score: 0.8,
  color: 'var(--coral-deep)',
  detail: 'Egy adag a slot büdzsé 92%-a.',
  context: [{ label: 'Adag kcal', value: '620 kcal' }],
}

test('a context csempe kinyitva megkapja az időzítés-sávot', () => {
  const { container } = renderOpen(contextDimWithTiming)
  expect(container.querySelector('.sb-tline')).toBeInTheDocument()
  // a tény-chipek MEGMARADNAK a sáv alatt
  expect(container.querySelectorAll('.sb-fchip').length).toBeGreaterThan(0)
})

test('timing nélküli context csempe csak a tény-chipeket mutatja', () => {
  const { container } = renderOpen(contextDimWithoutTiming)
  expect(container.querySelector('.sb-tline')).not.toBeInTheDocument()
  expect(container.querySelectorAll('.sb-fchip').length).toBeGreaterThan(0)
})

test('a többi sor-dimenzió (who, portion, …) SOHA nem kap sávot', () => {
  const { container } = renderOpen(portionDim)
  expect(container.querySelector('.sb-tline')).not.toBeInTheDocument()
})
