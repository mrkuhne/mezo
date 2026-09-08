import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { MapPointInspectorBody } from '@/features/admin/memory/views/MapInspector'
import { ADMIN_MEMORY_NEIGHBORS_MOCK, ADMIN_MEMORY_VECTORS_MOCK } from '@/data/admin/adminMemoryMock'

// Térkép point inspector body (mezo-4qyt.5, Step 5.6): neighbours render with their real cosine
// similarity, and the "screen distance != vector distance" caveat is always present so the
// surface never implies the 2D map IS the similarity.

const [ITEM] = ADMIN_MEMORY_VECTORS_MOCK.items

function renderBody(neighborsPending = false) {
  render(
    <MemoryRouter>
      <MapPointInspectorBody item={ITEM} neighbors={ADMIN_MEMORY_NEIGHBORS_MOCK.neighbors} neighborsPending={neighborsPending} />
    </MemoryRouter>,
  )
}

describe('MapPointInspectorBody', () => {
  it('renders every neighbour with its real cosine similarity', () => {
    renderBody()
    for (const n of ADMIN_MEMORY_NEIGHBORS_MOCK.neighbors) {
      expect(screen.getByText(n.snippet)).toBeInTheDocument()
      expect(screen.getByText(n.similarity.toFixed(3))).toBeInTheDocument()
    }
  })

  it('carries the screen-distance-vs-vector-distance caveat', () => {
    renderBody()
    expect(screen.getByText(/2D-re hajtogatott vetület/)).toBeInTheDocument()
    expect(screen.getByText(/768 dimenzióban a legközelebbiek/)).toBeInTheDocument()
  })

  it('shows a loading state instead of an empty list while neighbours are pending', () => {
    renderBody(true)
    expect(screen.getByText('Betöltés…')).toBeInTheDocument()
  })

  it('shows the item content, sourceKind and salience', () => {
    renderBody()
    expect(screen.getByText(ITEM.snippet)).toBeInTheDocument()
    expect(screen.getByText(ITEM.sourceKind)).toBeInTheDocument()
    expect(screen.getByText(ITEM.salience.toFixed(2))).toBeInTheDocument()
  })
})
