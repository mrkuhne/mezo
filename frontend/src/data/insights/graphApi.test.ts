import { toLifeEventCandidate, toKnowledgeGraphNode } from '@/data/insights/graphApi'

describe('graphApi wire mapping', () => {
  it('toLifeEventCandidate keeps createdAt (mezo-zpxv7 who/when)', () => {
    const candidate = toLifeEventCandidate({
      id: 'n1', kind: 'LIFE_EVENT', title: 'Új munkahely első hete', summary: 'Első hét.',
      status: 'candidate', occurredOn: '2026-08-21', proposedEdgeCount: 1,
      createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z',
    })
    expect(candidate).toEqual({
      id: 'n1', kind: 'LIFE_EVENT', title: 'Új munkahely első hete', summary: 'Első hét.',
      occurredOn: '2026-08-21', proposedEdgeCount: 1, createdAt: '2026-08-22T02:00:00Z',
    })
  })

  it('toLifeEventCandidate maps a missing summary/occurredOn to null and unknown kinds to LIFE_EVENT', () => {
    const candidate = toLifeEventCandidate({
      id: 'n2', kind: 'GOAL', title: 'x', status: 'candidate',
      createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z',
    })
    expect(candidate).toMatchObject({ kind: 'LIFE_EVENT', summary: null, occurredOn: null, proposedEdgeCount: 0 })
  })

  it('toKnowledgeGraphNode keeps occurredOn ?? null (mezo-zpxv7 timeline dates)', () => {
    const node = toKnowledgeGraphNode({
      id: 'gn-4', kind: 'LIFE_EVENT', title: 'Új munkahely első hete', summary: null,
      status: 'active', occurredOn: '2026-08-21', topEdges: [],
      createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T08:00:00Z', proposedEdgeCount: 0,
    })
    expect(node).toEqual({
      id: 'gn-4', kind: 'LIFE_EVENT', title: 'Új munkahely első hete', summary: null,
      topEdges: [], sourceKind: null, updatedAt: '2026-08-22T08:00:00Z', occurredOn: '2026-08-21',
    })
  })

  it('toKnowledgeGraphNode defaults occurredOn to null when the wire omits it', () => {
    const node = toKnowledgeGraphNode({
      id: 'gn-1', kind: 'PATTERN', title: 'Késői evés rontja az alvást', summary: null,
      status: 'active', topEdges: [],
      createdAt: '2026-08-20T02:00:00Z', updatedAt: '2026-08-20T10:00:00Z', proposedEdgeCount: 0,
    })
    expect(node.occurredOn).toBeNull()
  })
})
