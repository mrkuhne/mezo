import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AdminTile } from '@/features/admin/components/AdminTile'

// mezo-d5iy.16: a real-mode cold load must paint a loading state, never the zeroed
// `realEmpty` content `useDualQuery` deliberately returns while the fetch is in flight (see
// that hook's own doc comment — this behavior is BY DESIGN and not something AdminTile can
// change). AdminTile's `isPending` branch is what stops "0 fiók"/"$0.00"/empty sparklines from
// flashing during that window instead.
describe('AdminTile', () => {
  it('renders a pending placeholder instead of the children while isPending', () => {
    render(
      <AdminTile query={{ isError: false, isPending: true, refetch: vi.fn() }} wash="sky" eyebrow="Userek">
        <div>0 fiók</div>
      </AdminTile>,
    )
    expect(screen.queryByText('0 fiók')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Betöltés…')).toBeInTheDocument()
  })

  it('renders the error state (not the pending state) when both isError and isPending are true', () => {
    const refetch = vi.fn()
    render(
      <AdminTile query={{ isError: true, isPending: true, refetch }} wash="sky" eyebrow="Userek">
        <div>content</div>
      </AdminTile>,
    )
    expect(screen.getByText('Ez az adat jelenleg nem elérhető.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Betöltés…')).not.toBeInTheDocument()
  })

  it('renders the children once resolved (neither isError nor isPending)', () => {
    render(
      <AdminTile query={{ isError: false, isPending: false, refetch: vi.fn() }} wash="sky" eyebrow="Userek">
        <div>1 234 fiók</div>
      </AdminTile>,
    )
    expect(screen.getByText('1 234 fiók')).toBeInTheDocument()
    expect(screen.queryByLabelText('Betöltés…')).not.toBeInTheDocument()
  })

  // Üveg (mezo-me75u.10): every admin tile is a glass tile whose accent follows `wash`, and the
  // error state carries the ⓘ 3D icon (never a text glyph).
  it('wears the glass material with its wash as the accent hook, and an ⓘ icon on error', () => {
    const { container, rerender } = render(
      <AdminTile query={{ isError: false, isPending: false, refetch: vi.fn() }} wash="gold" eyebrow="Költés">
        <div>$1,84</div>
      </AdminTile>,
    )
    const tile = container.querySelector('.mz-tile')
    expect(tile).toHaveClass('glass', 'ad-gt', 'mz-w-gold')
    rerender(
      <AdminTile query={{ isError: true, isPending: false, refetch: vi.fn() }} wash="gold" eyebrow="Költés">
        <div>$1,84</div>
      </AdminTile>,
    )
    expect(container.querySelector('.ad-tile-error use')?.getAttribute('href')).toBe('#t-info')
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  })
})
