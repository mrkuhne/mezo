import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { GraphView, KIND_COLOR } from '@/features/admin/memory/views/GraphView'
import { ADMIN_MEMORY_GRAPH_MOCK } from '@/data/admin/adminMemoryMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderGraphView(sel: string | null = null, onSelect = vi.fn(), onInspect = vi.fn()) {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GraphView userId="u-1" isOwner sel={sel} onSelect={onSelect} onInspect={onInspect} />
      </MemoryRouter>
    </QueryWrapper>,
  )
  return { onSelect, onInspect }
}

const [NODE_ACTIVE, , NODE_CANDIDATE] = ADMIN_MEMORY_GRAPH_MOCK.nodes
const [EDGE_TRIGGERS, EDGE_CONFLICTS] = ADMIN_MEMORY_GRAPH_MOCK.edges

describe('GraphView (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('KIND_COLOR maps all seven node kinds so a new one cannot render invisible', () => {
    for (const kind of ['PATTERN', 'PREFERENCE', 'GOAL', 'LIFE_EVENT', 'SEASON', 'INSIGHT', 'PERSON']) {
      expect(KIND_COLOR[kind]).toBeDefined()
    }
  })

  it('a candidate node renders faded (opacity .45)', async () => {
    renderGraphView()
    const g = await screen.findByTestId(`am-node-${NODE_CANDIDATE.id}`)
    const circle = g.querySelector('circle')!
    expect(circle.getAttribute('opacity')).toBe('0.45')
  })

  it('a CONFLICTS edge renders dashed', async () => {
    renderGraphView()
    const line = await screen.findByTestId(`am-edge-${EDGE_CONFLICTS.id}`)
    expect(line.getAttribute('stroke-dasharray')).toBe('6 5')
  })

  it('a non-CONFLICTS edge renders solid', async () => {
    renderGraphView()
    const line = await screen.findByTestId(`am-edge-${EDGE_TRIGGERS.id}`)
    expect(line.getAttribute('stroke-dasharray')).toBeNull()
  })

  it('the weight slider removes edges below the threshold but keeps the now-isolated node', async () => {
    renderGraphView()
    await screen.findByTestId(`am-edge-${EDGE_CONFLICTS.id}`)
    const slider = screen.getByLabelText('Súly-küszöb')
    fireEvent.change(slider, { target: { value: '0.5' } })

    // EDGE_CONFLICTS (weight 0.18) drops below the 0.5 threshold; EDGE_TRIGGERS (0.62) stays.
    expect(screen.queryByTestId(`am-edge-${EDGE_CONFLICTS.id}`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`am-edge-${EDGE_TRIGGERS.id}`)).toBeInTheDocument()
    // The now-edgeless node is still data, not noise.
    expect(screen.getByTestId(`am-node-${NODE_CANDIDATE.id}`)).toBeInTheDocument()
  })

  it('a kind filter chip hides nodes of other kinds', async () => {
    renderGraphView()
    await screen.findByTestId(`am-node-${NODE_ACTIVE.id}`)
    fireEvent.click(screen.getByRole('button', { name: /GOAL/ }))
    expect(screen.queryByTestId(`am-node-${NODE_ACTIVE.id}`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`am-node-${NODE_CANDIDATE.id}`)).toBeInTheDocument()
  })

  it('the title search filters nodes by title', async () => {
    renderGraphView()
    await screen.findByTestId(`am-node-${NODE_ACTIVE.id}`)
    fireEvent.change(screen.getByPlaceholderText('cím keresése…'), { target: { value: 'edzésszám' } })
    expect(screen.queryByTestId(`am-node-${NODE_ACTIVE.id}`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`am-node-${NODE_CANDIDATE.id}`)).toBeInTheDocument()
  })

  it('clicking a node selects it', async () => {
    const { onSelect } = renderGraphView()
    const g = await screen.findByTestId(`am-node-${NODE_ACTIVE.id}`)
    fireEvent.click(g)
    expect(onSelect).toHaveBeenCalledWith(NODE_ACTIVE.id)
  })

  it('a sel matching nothing is ignored silently (no crash, empty inspector)', async () => {
    const { onInspect } = renderGraphView('unknown-id-xyz')
    await screen.findByTestId(`am-node-${NODE_ACTIVE.id}`)
    await waitFor(() => expect(onInspect).toHaveBeenCalledWith(null))
  })

  it('selecting a node calls onInspect with a node body', async () => {
    const { onInspect } = renderGraphView(NODE_ACTIVE.id)
    await screen.findByTestId(`am-node-${NODE_ACTIVE.id}`)
    await waitFor(() => expect(onInspect).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining(NODE_ACTIVE.title) })))
  })
})

describe('GraphView (real mode) — archived/deleted toggles feed the query key', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('toggling Archiváltak/Töröltek changes the request URL', async () => {
    const seenUrls: string[] = []
    server.use(http.get(`${API_BASE}/api/admin/users/:userId/memory/graph`, ({ request }) => {
      seenUrls.push(request.url)
      return HttpResponse.json(ADMIN_MEMORY_GRAPH_MOCK)
    }))
    renderGraphView()
    await screen.findByTestId(`am-node-${NODE_ACTIVE.id}`)
    expect(seenUrls.some((u) => u.includes('includeArchived=false') && u.includes('includeDeleted=false'))).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Archiváltak' }))
    await waitFor(() => expect(seenUrls.some((u) => u.includes('includeArchived=true') && u.includes('includeDeleted=false'))).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: 'Töröltek' }))
    await waitFor(() => expect(seenUrls.some((u) => u.includes('includeArchived=true') && u.includes('includeDeleted=true'))).toBe(true))
  })
})
