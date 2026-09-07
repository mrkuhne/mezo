import { describe, it, expect } from 'vitest'
import { edgeWidth, layout, nodeRadius } from '@/features/admin/memory/graphLayout'
import type { AdminMemoryGraphEdge, AdminMemoryGraphNode } from '@/data/admin/adminMemoryApi'

function node(overrides: Partial<AdminMemoryGraphNode> & { id: string }): AdminMemoryGraphNode {
  return {
    kind: 'PATTERN',
    title: overrides.id,
    summary: null,
    status: 'active',
    sourceKind: null,
    sourceId: null,
    occurredOn: null,
    userArchivedAt: null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: null,
    deleted: false,
    meta: null,
    degree: 1,
    ...overrides,
  }
}

function edge(overrides: Partial<AdminMemoryGraphEdge> & { id: string; from: string; to: string }): AdminMemoryGraphEdge {
  return {
    kind: 'RELATES_TO',
    weight: 0.5,
    lastReinforcedAt: null,
    createdAt: '2026-09-01T00:00:00Z',
    deleted: false,
    evidence: [],
    ...overrides,
  }
}

const SIZE = { width: 800, height: 400 }

describe('graphLayout.layout', () => {
  it('is deterministic for identical input', () => {
    const nodes = [node({ id: 'a' }), node({ id: 'b' }), node({ id: 'c' })]
    const edges = [edge({ id: 'e1', from: 'a', to: 'b' }), edge({ id: 'e2', from: 'b', to: 'c' })]

    const first = layout(nodes, edges, SIZE)
    const second = layout(nodes, edges, SIZE)

    expect(second.nodes).toEqual(first.nodes)
    expect(second.links).toEqual(first.links)
  })

  it('drops a link to an unknown node id rather than throwing', () => {
    const nodes = [node({ id: 'a' }), node({ id: 'b' })]
    const edges = [edge({ id: 'e1', from: 'a', to: 'b' }), edge({ id: 'e-dangling', from: 'a', to: 'ghost' })]

    const result = layout(nodes, edges, SIZE)

    expect(result.links.map((l) => l.id)).toEqual(['e1'])
    expect(result.nodes).toHaveLength(2)
  })

  it('bounds the radius of a high-degree hub node', () => {
    const nodes = [node({ id: 'hub', degree: 50 }), node({ id: 'leaf', degree: 0 })]
    const result = layout(nodes, [], SIZE)

    const hub = result.nodes.find((n) => n.id === 'hub')!
    const leaf = result.nodes.find((n) => n.id === 'leaf')!
    expect(hub.radius).toBeLessThanOrEqual(18)
    expect(hub.radius).toBeGreaterThan(leaf.radius)
  })

  it('nodeRadius/edgeWidth are pure and bounded', () => {
    expect(nodeRadius(0)).toBe(7)
    expect(nodeRadius(50)).toBeCloseTo(18, 5)
    expect(edgeWidth(0)).toBeCloseTo(0.6, 5)
    expect(edgeWidth(1)).toBeCloseTo(3.6, 5)
  })

  it('a stronger edge ends up shorter than a weak one', () => {
    // Three nodes: a hub 'center' linked strongly to 'strong' and weakly to 'weak'.
    const nodes = [node({ id: 'center', degree: 2 }), node({ id: 'strong', degree: 1 }), node({ id: 'weak', degree: 1 })]
    const edges = [
      edge({ id: 'e-strong', from: 'center', to: 'strong', weight: 0.95 }),
      edge({ id: 'e-weak', from: 'center', to: 'weak', weight: 0.05 }),
    ]

    const result = layout(nodes, edges, SIZE)
    const byId = new Map(result.nodes.map((n) => [n.id, n]))
    const center = byId.get('center')!
    const strong = byId.get('strong')!
    const weak = byId.get('weak')!

    const dist = (a: typeof center, b: typeof center) => Math.hypot(a.x - b.x, a.y - b.y)
    expect(dist(center, strong)).toBeLessThan(dist(center, weak))
  })
})
