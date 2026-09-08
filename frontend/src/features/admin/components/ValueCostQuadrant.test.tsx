import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { ValueCostQuadrant } from '@/features/admin/components/ValueCostQuadrant'
import { ADMIN_FEATURE_BOARD_MOCK } from '@/data/admin/adminInsightsMock'

// mezo-kxnn Task 2 — the quadrant only ever plots the mock board's non-system, actually-used
// rows (6 of the 7 seeded rows: everything but the `unknown` system bucket), renders all four
// muted corner captions, and prints the "csak a használt funkciók" exclusion note under the
// chart. Point count is asserted via the per-point `<title>` tooltip (RTL's `getByTitle` also
// matches an SVG `<title>` child, not just a `title` attribute).

function renderQuadrant(rows = ADMIN_FEATURE_BOARD_MOCK.rows) {
  return render(
    <MemoryRouter>
      <ValueCostQuadrant rows={rows} />
    </MemoryRouter>,
  )
}

describe('ValueCostQuadrant', () => {
  it('plots one point per non-system, used row from the mock seed', () => {
    renderQuadrant()
    const titles = screen.getByRole('img', { name: 'Érték/költség négyesmátrix' }).querySelectorAll('circle.pt title')
    expect(titles.length).toBe(6)
  })

  it('excludes system rows and zero-use rows', () => {
    renderQuadrant()
    expect(screen.queryByTitle(/Ismeretlen hívás/)).not.toBeInTheDocument()
  })

  it('renders all four muted quadrant captions', () => {
    renderQuadrant()
    expect(screen.getByText('ezért kérhetünk pénzt')).toBeInTheDocument()
    expect(screen.getByText('ingyenes csali')).toBeInTheDocument()
    expect(screen.getByText('spórolni itt lehet')).toBeInTheDocument()
    expect(screen.getByText('figyelni')).toBeInTheDocument()
  })

  it('documents the median-split lines and the used-only exclusion under the chart', () => {
    renderQuadrant()
    expect(screen.getByText('a felezővonalak a középértékek')).toBeInTheDocument()
    expect(screen.getByText('csak a használt funkciók')).toBeInTheDocument()
  })

  it('renders an honest empty state when every row is system or zero-use', () => {
    renderQuadrant(ADMIN_FEATURE_BOARD_MOCK.rows.filter((r) => r.kind === 'system'))
    expect(screen.getByText('Nincs használt funkció ebben az időszakban.')).toBeInTheDocument()
    expect(screen.getByText('csak a használt funkciók')).toBeInTheDocument()
  })

  // Final review Finding 2 — the on-screen point label used to drop the missing-marker the
  // <title> tooltip already carried. `getByTitle` isn't usable here: RTL's own `isSvgTitle` check
  // requires the `<title>`'s parentElement to literally be `<svg>` (`svg > title`), which never
  // matches a title nested inside a `<circle>` — hence reading the tooltip text via the same
  // `querySelectorAll` idiom the point-count test above already uses.
  it('renders the missing-marker on an unlabelled feature\'s on-screen point label, not just its tooltip', () => {
    renderQuadrant([
      ...ADMIN_FEATURE_BOARD_MOCK.rows,
      {
        key: 'brand_new_unlabelled_slug', kind: 'ai', uniqueUsers: 2,
        usesPerWeek: Array(12).fill(1), habitUserShare: 0.1, helped: null, acceptedShare: null,
        costUsd: 1, costPerUse: 0.5, unknownCalls: 0, errorPct: 0, p90LatencyMs: 100, screenViews: null,
      },
    ])
    expect(screen.getByText('brand_new_unlabelled_slug (nincs címke)')).toBeInTheDocument()
    const titles = Array.from(
      screen.getByRole('img', { name: 'Érték/költség négyesmátrix' }).querySelectorAll('circle.pt title'),
    )
    expect(titles.some((t) => /brand_new_unlabelled_slug \(nincs címke\)/.test(t.textContent ?? ''))).toBe(true)
  })
})
