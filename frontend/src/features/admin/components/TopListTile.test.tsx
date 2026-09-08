import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { TopListTile, type TopRow } from '@/features/admin/components/TopListTile'

// mezo-m079 Task 2, fix round 1 — rank number, label+sub, share bar width (or its bar-less
// `tone` variant), right-aligned value, per-row link (when `to` is given), and the trailing
// "összes →" drill link. `title` is the card's accessible name only (aria-label) — the visible
// caption lives in the enclosing AdminTile's own eyebrow, not here (fix round 1: this component
// used to ALSO render its own visible eyebrow + <h3>, duplicating the enclosing tile's caption).

const ROWS: TopRow[] = [
  { key: 'u1', label: 'Anna', value: '$6.00', share: 1, to: '/admin/users/u1' },
  { key: 'bg', label: 'Háttér', sub: 'rendszer', value: '$0.50', share: 0.08 },
]

function renderTile(rows: TopRow[] = ROWS) {
  return render(
    <MemoryRouter>
      <TopListTile
        title="Kik viszik a költést"
        rows={rows}
        moreLabel="Minden tesztelő →"
        moreTo="/admin/users"
      />
    </MemoryRouter>,
  )
}

describe('TopListTile', () => {
  it('renders no visible heading of its own — only an accessible name (aria-label)', () => {
    const { container } = renderTile()
    expect(screen.queryByText('Kik viszik a költést')).not.toBeInTheDocument()
    expect(container.querySelector('h3')).not.toBeInTheDocument()
    expect(container.querySelector('.ad-eyebrow')).not.toBeInTheDocument()
    expect(container.querySelector('.ad-top')).toHaveAttribute('aria-label', 'Kik viszik a költést')
  })

  it('renders a ranked row per entry with label, sub and the formatted value', () => {
    renderTile()
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
    expect(screen.getByText('Háttér')).toBeInTheDocument()
    expect(screen.getByText('rendszer')).toBeInTheDocument()
    expect(screen.getByText('$6.00')).toBeInTheDocument()
    expect(screen.getByText('$0.50')).toBeInTheDocument()
  })

  it('sets the share bar width from row.share', () => {
    const { container } = renderTile()
    const bars = container.querySelectorAll('.sharebar i')
    expect(bars[0]).toHaveStyle({ transform: 'scaleX(1)' })
    expect(bars[1]).toHaveStyle({ transform: 'scaleX(0.08)' })
  })

  it('omits the share bar entirely for a bar-less row (share undefined), per its own tone', () => {
    const { container } = render(
      <MemoryRouter>
        <TopListTile
          title="Csendes tesztelők"
          rows={[
            { key: 'q1', label: 'Anna', value: '5 napja', tone: 'warn' },
            { key: 'q2', label: 'Béla', value: 'még nem aktív', tone: 'mut' },
          ]}
          moreLabel="Minden tesztelő →"
          moreTo="/admin/users"
        />
      </MemoryRouter>,
    )
    expect(container.querySelectorAll('.sharebar')).toHaveLength(0)
    expect(screen.getByText('5 napja')).toHaveClass('val', 'warn')
    expect(screen.getByText('még nem aktív')).toHaveClass('val', 'mut')
  })

  it('renders a row with `to` as a link, and one without as plain content', () => {
    renderTile()
    expect(screen.getByRole('link', { name: /Anna/ })).toHaveAttribute('href', '/admin/users/u1')
    expect(screen.queryByRole('link', { name: /Háttér/ })).not.toBeInTheDocument()
  })

  it('renders the moreTo link with moreLabel', () => {
    renderTile()
    expect(screen.getByRole('link', { name: 'Minden tesztelő →' })).toHaveAttribute('href', '/admin/users')
  })

  it('renders an honest empty state instead of a blank list', () => {
    renderTile([])
    expect(screen.getByText('Nincs adat.')).toBeInTheDocument()
  })

  it('appends the unit to the value when given', () => {
    render(
      <MemoryRouter>
        <TopListTile
          title="Mire megy a pénz"
          rows={[{ key: 'f1', label: 'Beszélgetés', value: '128', share: 1 }]}
          moreLabel="Összes funkció →"
          moreTo="/admin/cost"
          unit="hívás"
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('128 hívás')).toBeInTheDocument()
  })
})
