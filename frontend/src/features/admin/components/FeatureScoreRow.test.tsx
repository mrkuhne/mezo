import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { FeatureScoreRow } from '@/features/admin/components/FeatureScoreRow'
import type { AdminFeatureRow } from '@/data/admin/adminInsightsApi'

const BASE: AdminFeatureRow = {
  key: 'companion_chat',
  kind: 'ai',
  uniqueUsers: 8,
  usesPerWeek: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  habitUserShare: 0.5,
  helped: { up: 14, down: 3 },
  acceptedShare: null,
  costUsd: 42.3,
  costPerUse: 0.62,
  unknownCalls: 0,
  errorPct: 2.1,
  p90LatencyMs: 1400,
  screenViews: null,
}

function renderRow(row: AdminFeatureRow) {
  return render(<MemoryRouter><FeatureScoreRow row={row} /></MemoryRouter>)
}

describe('FeatureScoreRow', () => {
  it('renders the HU label, kind chip, unique users, sparkline and habit share', () => {
    renderRow(BASE)
    expect(screen.getByText('Beszélgetés a társsal')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /12 hét/ })).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('renders an unlabelled key with the missing-marker', () => {
    renderRow({ ...BASE, key: 'brand_new_slug_x' })
    expect(screen.getByText('brand_new_slug_x (nincs címke)')).toBeInTheDocument()
  })

  it('renders helped counts with ▲/▼ glyphs, no emoji', () => {
    renderRow(BASE)
    expect(screen.getByText('▲ 14')).toBeInTheDocument()
    expect(screen.getByText('▼ 3')).toBeInTheDocument()
  })

  it('renders the honest "nincs visszajelzés-forrás" copy when helped is null, never 0%', () => {
    renderRow({ ...BASE, helped: null })
    expect(screen.getByText('nincs visszajelzés-forrás')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('renders cost and cost-per-use, and "–" when cost-per-use is null', () => {
    renderRow(BASE)
    expect(screen.getByText('$42.30')).toBeInTheDocument()
    expect(screen.getByText('$0.62/haszn.')).toBeInTheDocument()
    renderRow({ ...BASE, key: 'meal_coach', costPerUse: null })
    expect(screen.getByText('–')).toBeInTheDocument()
  })

  it('renders a grey reliability dot with no percentage when errorPct is null', () => {
    const { container } = renderRow({ ...BASE, errorPct: null, p90LatencyMs: null })
    const dot = container.querySelector('.ad-reliability-dot')
    expect(dot).toHaveClass('grey')
    expect(dot).toHaveAttribute('aria-label', 'megbízhatóság: nincs adat')
  })

  it('colors the reliability dot sage/gold/coral by errorPct threshold', () => {
    const { container: sage } = renderRow({ ...BASE, errorPct: 2 })
    expect(sage.querySelector('.ad-reliability-dot')).toHaveClass('sage')
    const { container: gold } = renderRow({ ...BASE, key: 'meal_draft', errorPct: 15 })
    expect(gold.querySelector('.ad-reliability-dot')).toHaveClass('gold')
    const { container: coral } = renderRow({ ...BASE, key: 'meal_coach', errorPct: 25 })
    expect(coral.querySelector('.ad-reliability-dot')).toHaveClass('coral')
  })

  it('links the whole row to the detail page', () => {
    renderRow(BASE)
    expect(screen.getByRole('link', { name: 'Beszélgetés a társsal' })).toHaveAttribute(
      'href',
      '/admin/features/companion_chat',
    )
  })
})
