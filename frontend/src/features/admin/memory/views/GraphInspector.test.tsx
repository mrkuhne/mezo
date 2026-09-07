import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { GraphEdgeInspectorBody, GraphNodeInspectorBody, ValidityBar } from '@/features/admin/memory/views/GraphInspector'
import { ADMIN_MEMORY_GRAPH_MOCK } from '@/data/admin/adminMemoryMock'

const [NODE_ACTIVE] = ADMIN_MEMORY_GRAPH_MOCK.nodes
const [EDGE_TRIGGERS, EDGE_CONFLICTS] = ADMIN_MEMORY_GRAPH_MOCK.edges

function renderNode() {
  return render(
    <MemoryRouter>
      <GraphNodeInspectorBody node={NODE_ACTIVE} graph={ADMIN_MEMORY_GRAPH_MOCK} onSelectEdge={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('GraphNodeInspectorBody', () => {
  it('renders kind/status/degree', () => {
    renderNode()
    expect(screen.getByText('kind')).toBeInTheDocument()
    expect(screen.getByText(NODE_ACTIVE.kind)).toBeInTheDocument()
    expect(screen.getByText('status')).toBeInTheDocument()
    expect(screen.getByText(String(NODE_ACTIVE.degree))).toBeInTheDocument()
  })

  it('lists in/out edges', () => {
    renderNode()
    // NODE_ACTIVE (n1) is the `from` of EDGE_TRIGGERS — an out-edge.
    expect(screen.getByText(new RegExp(EDGE_TRIGGERS.kind))).toBeInTheDocument()
  })
})

describe('GraphEdgeInspectorBody', () => {
  it('renders evidence rows with source links', () => {
    render(
      <MemoryRouter>
        <GraphEdgeInspectorBody edge={EDGE_TRIGGERS} graph={ADMIN_MEMORY_GRAPH_MOCK} fromRun={false} />
      </MemoryRouter>,
    )
    expect(EDGE_TRIGGERS.evidence?.length).toBeGreaterThan(0)
    expect(screen.getByText(/két egymást követő rossz éjszaka/)).toBeInTheDocument()
  })

  it('an edge with no evidence renders the honest empty line', () => {
    render(
      <MemoryRouter>
        <GraphEdgeInspectorBody edge={EDGE_CONFLICTS} graph={ADMIN_MEMORY_GRAPH_MOCK} fromRun={false} />
      </MemoryRouter>,
    )
    expect(EDGE_CONFLICTS.evidence ?? []).toHaveLength(0)
    expect(screen.getByText('nincs evidencia')).toBeInTheDocument()
  })

  it('the run-origin honesty line appears only when arrived from a run', () => {
    const { rerender } = render(
      <MemoryRouter>
        <GraphEdgeInspectorBody edge={EDGE_TRIGGERS} graph={ADMIN_MEMORY_GRAPH_MOCK} fromRun={false} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/A futásban tárolt él-súly/)).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <GraphEdgeInspectorBody edge={EDGE_TRIGGERS} graph={ADMIN_MEMORY_GRAPH_MOCK} fromRun />
      </MemoryRouter>,
    )
    expect(screen.getByText(/A futásban tárolt él-súly/)).toBeInTheDocument()
  })
})

describe('ValidityBar', () => {
  it('renders the decay estimate labelled becsült', () => {
    render(<ValidityBar createdAt="2026-07-01T00:00:00Z" lastReinforcedAt="2026-09-05T00:00:00Z" decayFactor={0.99} pruneBelow={0.05} weight={0.62} />)
    expect(screen.getByText(/nap múlva kiesik/)).toBeInTheDocument()
    expect(screen.getByText('(becsült)')).toBeInTheDocument()
  })

  it('an edge already at/under the prune floor says so instead of estimating', () => {
    render(<ValidityBar createdAt="2026-07-01T00:00:00Z" lastReinforcedAt={null} decayFactor={0.99} pruneBelow={0.05} weight={0.05} />)
    expect(screen.getByText(/a küszöb alatt/)).toBeInTheDocument()
  })
})
