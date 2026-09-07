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
})
