import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { MosaicDesktop } from '@/shared/ui/mozaik'
import { useAdminMemoryGraph } from '@/data/admin/adminMemoryHooks'
import { layout, type LaidOutNode } from '@/features/admin/memory/graphLayout'
import { GraphEdgeInspectorBody, GraphNodeInspectorBody } from '@/features/admin/memory/views/GraphInspector'
import type { InspectorBody } from '@/features/admin/memory/views/RunDetail'
import type { AdminMemoryGraphResponse } from '@/data/admin/adminMemoryApi'
import { memoryTermLabel } from '@/features/admin/lib/labels'

// Gráf (mezo-4qyt.4, Step 4.2) — d3-force layout, hand-written SVG. A node kind's colour is
// fixed (`KIND_COLOR`), covering all SEVEN kinds including PERSON (`GraphNodeEntity.KIND_PERSON`
// — the companion doc's table still omits it, but the colour map must cover it now). A missing
// kind falls back to a neutral grey so a new node kind never renders invisible.
export const KIND_COLOR: Record<string, string> = {
  PATTERN: '#4E8FB8',
  PREFERENCE: '#C9962E',
  GOAL: '#D8481F',
  LIFE_EVENT: '#5D4FA0',
  SEASON: '#6E8B5E',
  INSIGHT: '#C46FA0',
  PERSON: '#3F8A7A',
}
const FALLBACK_KIND_COLOR = '#8B7E6E'
const CONFLICTS_STROKE = '#A8452A'
const EDGE_STROKE = '#4E8FB8'

const KIND_ORDER = ['PATTERN', 'PREFERENCE', 'GOAL', 'LIFE_EVENT', 'SEASON', 'INSIGHT', 'PERSON']
const EDGE_KIND_ORDER = ['TRIGGERS', 'PRECEDED_BY', 'SUPPORTS', 'CONFLICTS', 'RELATES_TO']
const VIEWBOX = { width: 760, height: 380 }

export function GraphView({
  userId,
  isOwner,
  sel,
  onSelect,
  onInspect,
}: {
  userId: string
  isOwner: boolean
  sel: string | null
  onSelect: (id: string | null) => void
  onInspect: (body: InspectorBody | null) => void
}) {
  const [includeArchived, setIncludeArchived] = useState(false)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [activeKinds, setActiveKinds] = useState<Set<string> | null>(null) // null = all kinds
  const [minWeight, setMinWeight] = useState(0)
  const [search, setSearch] = useState('')
  const [drag, setDrag] = useState<Record<string, { x: number; y: number }>>({})

  const graph = useAdminMemoryGraph(userId, includeArchived, includeDeleted, isOwner)

  // "Arrived from a run" tracking (Step 4.3's honesty line): a `sel` change that did NOT
  // originate from a click inside this view is treated as a deep link from a run candidate.
  const clickOriginRef = useRef(false)
  const [fromRun, setFromRun] = useState(sel != null)
  useEffect(() => {
    if (clickOriginRef.current) {
      clickOriginRef.current = false
      setFromRun(false)
    } else {
      setFromRun(sel != null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel])

  function select(id: string | null) {
    clickOriginRef.current = true
    onSelect(id)
  }

  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase()
    return graph.data.nodes.filter((n) => {
      if (activeKinds && !activeKinds.has(n.kind)) return false
      if (q && !n.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [graph.data.nodes, activeKinds, search])

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes])

  const filteredEdges = useMemo(
    () => graph.data.edges.filter((e) => e.weight >= minWeight && filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to)),
    [graph.data.edges, minWeight, filteredNodeIds],
  )

  // The layout is computed once per filtered dataset and then frozen — dragging moves ONE node
  // locally (below) without ever re-running the simulation.
  const laidOut = useMemo(() => layout(filteredNodes, filteredEdges, VIEWBOX), [filteredNodes, filteredEdges])

  const positionOf = (n: LaidOutNode) => drag[n.id] ?? { x: n.x, y: n.y }
  const nodeById = useMemo(() => new Map(laidOut.nodes.map((n) => [n.id, n])), [laidOut.nodes])

  function toggleKind(kind: string) {
    setActiveKinds((prev) => {
      if (!prev) return new Set([kind])
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next.size === 0 ? null : next
    })
  }

  useEffect(() => {
    onInspect(graphInspectorFor(graph.data, sel, fromRun, select))
    // `select` is a stable local wrapper; onInspect is the parent's setState wrapper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.data, sel, fromRun])

  if (graph.data.degraded) {
    return (
      <MosaicDesktop>
        <div className="am-degraded">
          <div className="t">A memória-felfedező ki van kapcsolva</div>
          <p>Ehhez a userhez (vagy ehhez a környezethez) a mezo.feature.admin-memory switch nincs bekapcsolva.</p>
        </div>
      </MosaicDesktop>
    )
  }

  return (
    <MosaicDesktop>
      <AdminTile query={graph} wash="lav" eyebrow="Tudásgráf" span={12}>
        <div className="am-graphctl">
          <span className="lbl">Fajta</span>
          <button type="button" className={`ad-chip${activeKinds == null ? ' on' : ''}`} onClick={() => setActiveKinds(null)}>mind</button>
          {KIND_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              className={`ad-chip am-kindchip${activeKinds != null && activeKinds.has(k) ? ' on' : ''}`}
              onClick={() => toggleKind(k)}
            >
              <i style={{ background: KIND_COLOR[k] }} />{memoryTermLabel(k).label}
            </button>
          ))}
        </div>
        <div className="am-graphctl">
          <span className="lbl">Súly-küszöb</span>
          <input
            className="am-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={minWeight}
            onChange={(e) => setMinWeight(Number(e.target.value))}
            aria-label="Súly-küszöb"
          />
          <span className="ad-mut" style={{ fontSize: 10.5 }}>≥ {minWeight.toFixed(2)}</span>
          <input
            className="am-search"
            placeholder="cím keresése…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className={`ad-chip${includeArchived ? ' on' : ''}`}
            onClick={() => setIncludeArchived((v) => !v)}
          >
            Archiváltak
          </button>
          <button
            type="button"
            className={`ad-chip${includeDeleted ? ' on' : ''}`}
            onClick={() => setIncludeDeleted((v) => !v)}
          >
            Töröltek
          </button>
        </div>

        <div className="am-graphwrap">
          <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} width="100%" style={{ display: 'block' }}>
            {laidOut.links.map((l) => {
              const source = nodeById.get(l.source)
              const target = nodeById.get(l.target)
              if (!source || !target) return null
              const p1 = positionOf(source)
              const p2 = positionOf(target)
              const isSelected = l.id === sel
              return (
                <line
                  key={l.id}
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={l.kind === 'CONFLICTS' ? CONFLICTS_STROKE : EDGE_STROKE}
                  strokeWidth={isSelected ? l.width + 2 : l.width}
                  strokeDasharray={l.kind === 'CONFLICTS' ? '6 5' : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={() => select(l.id)}
                  data-testid={`am-edge-${l.id}`}
                />
              )
            })}
            {laidOut.nodes.map((n) => {
              const pos = positionOf(n)
              const isCandidate = n.node.status === 'candidate'
              const isSelected = n.id === sel
              return (
                <g
                  key={n.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  style={{ cursor: 'grab' }}
                  data-testid={`am-node-${n.id}`}
                  onClick={(e) => { e.stopPropagation(); select(n.id) }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    const svg = (e.currentTarget.ownerSVGElement)
                    if (!svg) return
                    const rect = svg.getBoundingClientRect()
                    const scale = VIEWBOX.width / rect.width
                    const onMove = (ev: PointerEvent) => {
                      const x = (ev.clientX - rect.left) * scale
                      const y = (ev.clientY - rect.top) * scale
                      setDrag((d) => ({ ...d, [n.id]: { x, y } }))
                    }
                    const onUp = () => {
                      window.removeEventListener('pointermove', onMove)
                      window.removeEventListener('pointerup', onUp)
                    }
                    window.addEventListener('pointermove', onMove)
                    window.addEventListener('pointerup', onUp)
                  }}
                >
                  <circle
                    r={isSelected ? n.radius + 3 : n.radius}
                    fill={KIND_COLOR[n.kind] ?? FALLBACK_KIND_COLOR}
                    opacity={isCandidate ? 0.45 : 1}
                    stroke={n.node.deleted ? '#A2958A' : (isSelected ? '#2B2118' : undefined)}
                    strokeWidth={n.node.deleted || isSelected ? 2.5 : 0}
                    strokeDasharray={n.node.deleted ? '3 3' : undefined}
                  />
                  <title>{n.node.title}</title>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="am-legend2">
          {KIND_ORDER.map((k) => (
            <span key={k} title={memoryTermLabel(k).hint}><i style={{ background: KIND_COLOR[k] }} />{memoryTermLabel(k).label}</span>
          ))}
          <span style={{ opacity: 0.6 }}><i style={{ background: EDGE_STROKE, opacity: 0.45 }} />candidate (fakó)</span>
          <span><i style={{ background: 'transparent', border: '2px dashed #A2958A', borderRadius: '50%' }} />törölt (szaggatott perem)</span>
          <span>— él: <span style={{ borderBottom: `2px solid ${CONFLICTS_STROKE}`, paddingBottom: 1 }}>┅</span> {memoryTermLabel('CONFLICTS').label} (szaggatott)</span>
        </div>

        <div className="am-edgelegend">
          <div className="ad-eyebrow" style={{ marginBottom: 4 }}>Él-fajták</div>
          {EDGE_KIND_ORDER.map((k) => {
            const l = memoryTermLabel(k)
            return (
              <div key={k} className="row">
                <b>{l.label}</b>
                <span>{l.hint}</span>
              </div>
            )
          })}
        </div>

        <div className="ad-note9" style={{ fontSize: 9.5, color: '#A2958A', marginTop: 8 }}>
          A layout egyszer fut le és utána befagy — húzáskor csak a fogott csomópont mozdul, nincs újraszimuláció.
        </div>
      </AdminTile>
    </MosaicDesktop>
  )
}

/** Resolves the current selection into an inspector body, or `null` when nothing (or an unknown
 *  `sel`, e.g. an edge already pruned by the nightly pass) is selected. Exported so
 *  `GraphView.test.tsx` can assert the mapping without duplicating the lookup logic, and so
 *  AdminMemoryPage can compute the inspector title alongside its body. */
export function graphInspectorFor(
  graph: AdminMemoryGraphResponse,
  sel: string | null,
  fromRun: boolean,
  onSelectEdge: (id: string) => void,
): InspectorBody | null {
  if (!sel) return null
  const node = graph.nodes.find((n) => n.id === sel)
  if (node) return { title: `Csomópont — „${node.title}”`, content: <GraphNodeInspectorBody node={node} graph={graph} onSelectEdge={onSelectEdge} /> }
  const edge = graph.edges.find((e) => e.id === sel)
  if (edge) return { title: `Él — ${edge.kind}`, content: <GraphEdgeInspectorBody edge={edge} graph={graph} fromRun={fromRun} /> }
  return null
}
