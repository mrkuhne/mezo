import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from 'd3-force'
import type { AdminMemoryGraphEdge, AdminMemoryGraphNode } from '@/data/admin/adminMemoryApi'

// Gráf view (mezo-4qyt.4, Step 4.1) — the force simulation, isolated from React so it can be
// unit-tested without a DOM and without React's render loop.
//
// `forceSimulation(...).stop()` + an explicit `tick(TICKS)` loop rather than d3's own animation
// timer: the layout is computed once when the data changes and then frozen (the spec's "layout
// runs once then freezes; dragging moves locally"), so React never re-renders 60 times a second
// and the test environment needs no timers or requestAnimationFrame at all. It also makes the
// output DETERMINISTIC for a given input, which is what lets graphLayout.test.ts assert on
// positions.
//
// d3-force seeds initial positions from the node INDEX (a phyllotaxis spiral), not from
// Math.random, so identical input gives identical output without seeding anything ourselves.

const TICKS = 300
const MIN_RADIUS = 7
const MAX_RADIUS_BONUS = 11
const MIN_EDGE_WIDTH = 0.6
const EDGE_WIDTH_PER_WEIGHT = 3

export interface LaidOutNode {
  id: string
  x: number
  y: number
  degree: number
  kind: string
  radius: number
  node: AdminMemoryGraphNode
}

export interface LaidOutLink {
  id: string
  source: string
  target: string
  weight: number
  width: number
  kind: string
  edge: AdminMemoryGraphEdge
}

/** `r = 7 + min(11, sqrt(degree) * 4)` — bounded, so a hub node cannot swallow the canvas. */
export function nodeRadius(degree: number): number {
  return MIN_RADIUS + Math.min(MAX_RADIUS_BONUS, Math.sqrt(Math.max(0, degree)) * 4)
}

/** `0.6 + weight * 3` — a stronger edge renders thicker. */
export function edgeWidth(weight: number): number {
  return MIN_EDGE_WIDTH + weight * EDGE_WIDTH_PER_WEIGHT
}

interface SimNode extends SimulationNodeDatum {
  id: string
  degree: number
  kind: string
  radius: number
  node: AdminMemoryGraphNode
}

/**
 * Runs the force simulation to completion SYNCHRONOUSLY and returns frozen coordinates.
 *
 * The one bug this file must not have: `forceLink` throws on a link whose `source`/`target` id
 * is not in the node list. Slice 2's edge query already drops dangling edges, but the FE filters
 * (kind chips, weight slider) can ALSO remove a node — so this filters links against the node
 * set it was given, as its first statement.
 */
export function layout(
  nodes: AdminMemoryGraphNode[],
  edges: AdminMemoryGraphEdge[],
  size: { width: number; height: number },
): { nodes: LaidOutNode[]; links: LaidOutLink[] } {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const usableEdges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))

  const simNodes: SimNode[] = nodes.map((n) => {
    const degree = n.degree ?? 0
    return { id: n.id, degree, kind: n.kind, radius: nodeRadius(degree), node: n }
  })

  const simLinks = usableEdges.map((e) => ({ source: e.from, target: e.to, weight: e.weight, edge: e }))

  const simulation = forceSimulation(simNodes)
    .force(
      'link',
      forceLink<SimNode, typeof simLinks[number]>(simLinks)
        .id((d) => d.id)
        // a strong edge pulls harder — invert weight into distance, clamped away from zero
        .distance((l) => 40 / Math.max(0.05, l.weight)),
    )
    .force('charge', forceManyBody().strength(-180))
    .force('collide', forceCollide<SimNode>((d) => d.radius + 2))
    .force('center', forceCenter(size.width / 2, size.height / 2))
    .stop()

  for (let i = 0; i < TICKS; i++) simulation.tick()

  const laidOutNodes: LaidOutNode[] = simNodes.map((n) => ({
    id: n.id,
    x: n.x ?? 0,
    y: n.y ?? 0,
    degree: n.degree,
    kind: n.kind,
    radius: n.radius,
    node: n.node,
  }))

  const laidOutLinks: LaidOutLink[] = usableEdges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    weight: e.weight,
    width: edgeWidth(e.weight),
    kind: e.kind,
    edge: e,
  }))

  return { nodes: laidOutNodes, links: laidOutLinks }
}
