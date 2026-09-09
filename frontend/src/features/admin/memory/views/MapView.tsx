import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { MosaicDesktop } from '@/shared/ui/mozaik'
import { useAdminMemoryNeighbors, useAdminMemoryReplay, useAdminMemoryVectors } from '@/data/admin/adminMemoryHooks'
import { decodeProjection, l2Normalise } from '@/features/admin/memory/projection'
import { UMAP_PARAMS } from '@/features/admin/memory/umapConstants'
import { MapPointInspectorBody } from '@/features/admin/memory/views/MapInspector'
import type { InspectorBody } from '@/features/admin/memory/views/RunDetail'
import type { UmapResponse } from '@/features/admin/memory/umap.worker'
// Vite's `?worker` suffix turns the module into a Worker constructor (`new UmapWorker()`)
// instead of a plain import — this is the ONE seam `umapWorker.protocol.test.ts` mocks with
// `vi.mock`, since jsdom has no real Worker and the fake never runs umap-js.
import UmapWorker from '@/features/admin/memory/umap.worker?worker'

// Térkép (mezo-4qyt.5) — a umap-js Web Worker projects the server's PCA-50 block down to 2D for
// an SVG scatter; clicking a point fetches the 10 real pgvector neighbours so the inspector can
// say, honestly, that screen distance and vector distance are not the same thing.

export const SOURCE_KIND_COLOR: Record<string, string> = {
  sleep_log: '#6C5FA3',
  food_log: '#7FA06C',
  fuel_log: '#7FA06C',
  train_session: '#E1663F',
  workout: '#E1663F',
  journal_entry: '#4E8FB8',
  journal_note: '#4E8FB8',
  habit_day: '#C9962E',
  habit_tick: '#C9962E',
  chat_message: '#C46FA0',
  memory_item: '#4E8FB8',
}
const FALLBACK_SOURCE_COLOR = '#8B7E6E'
const SELECTED_STROKE = '#2B2118'
const NEIGHBOR_STROKE = '#345E78'
const QUERY_STROKE = '#A84A26'
const VIEWBOX = { width: 760, height: 340 }

type MapState =
  | { kind: 'idle' }
  | { kind: 'decoding' }
  | { kind: 'fitting'; coords: number[][] }
  | { kind: 'ready'; coords: number[][] }
  | { kind: 'fallback'; coords: number[][]; message: string }

function cacheKey(userId: string, embeddingVersion: string, itemCount: number): string {
  return `mezo.adminMemory.umap.${userId}.${embeddingVersion}.${itemCount}`
}

/** Every access wrapped in try/catch — a private window or blocked site data throws, and the map
 *  must still render (just without the cache). */
function readCache(key: string): number[][] | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as number[][]) : null
  } catch {
    return null
  }
}

function writeCache(key: string, coords: number[][]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(coords))
  } catch {
    // private window / blocked site data — nothing to do, the render already happened.
  }
}

/** Linear-fits a set of 2D coordinates into the SVG viewBox with padding. Returns a `scale`
 *  function so the SAME transform can be reused for a point computed later (e.g. the replayed
 *  query's star), instead of re-deriving the domain from a different set of points. */
function fitToViewbox(coords: number[][], width: number, height: number, pad = 26) {
  if (coords.length === 0) {
    return { points: [] as { x: number; y: number }[], scale: () => ({ x: width / 2, y: height / 2 }) }
  }
  const xs = coords.map((c) => c[0])
  const ys = coords.map((c) => c[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const scale = (p: number[]) => ({
    x: pad + ((p[0] - minX) / spanX) * (width - 2 * pad),
    y: pad + ((p[1] - minY) / spanY) * (height - 2 * pad),
  })
  return { points: coords.map(scale), scale }
}

export function MapView({
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
  const vectors = useAdminMemoryVectors(userId, null, isOwner)
  const neighbors = useAdminMemoryNeighbors(userId, sel, 10, isOwner)
  const replay = useAdminMemoryReplay(userId)

  const [state, setState] = useState<MapState>({ kind: 'idle' })
  const workerRef = useRef<Worker | null>(null)
  const pendingTransform = useRef<((coord: number[] | null) => void) | null>(null)
  const [query, setQuery] = useState('')
  const [star, setStar] = useState<{ coord: number[]; estimated: boolean; candidateIds: Set<string> } | null>(null)

  const items = vectors.data.items
  const dims = vectors.data.dims
  const embeddingVersion = vectors.data.embeddingVersion

  // Raw decoded PCA-50 rows (kept for the fallback path, which plots the FIRST TWO components
  // directly rather than anything umap-js produced) and the L2-normalised rows umap-js actually
  // fits on (normalised so its default euclidean metric is monotonically equivalent to cosine —
  // the metric pgvector's neighbours use).
  const decoded = useMemo(() => {
    if (items.length === 0 || !dims) return []
    try {
      return decodeProjection(vectors.data.projection, items.length, dims)
    } catch {
      return []
    }
  }, [vectors.data.projection, items.length, dims])
  const normalised = useMemo(() => l2Normalise(decoded), [decoded])

  useEffect(() => {
    setStar(null)
    if (decoded.length === 0) {
      setState({ kind: 'idle' })
      return
    }
    const key = cacheKey(userId, embeddingVersion, items.length)
    const cached = readCache(key)
    if (cached) {
      setState({ kind: 'ready', coords: cached })
      return
    }

    setState({ kind: 'decoding' })

    // First-class fallback state, not a console warning: plot PCA components 0/1 directly. Also
    // reached when the worker fails to construct at all (e.g. no Worker global), not only on a
    // runtime `error` message from an already-running one.
    const fallback = (message: string) =>
      setState({ kind: 'fallback', coords: decoded.map((row) => [row[0] ?? 0, row[1] ?? 0]), message })

    let worker: Worker
    try {
      worker = new UmapWorker()
    } catch (e) {
      fallback(e instanceof Error ? e.message : String(e))
      return
    }
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<UmapResponse>) => {
      const msg = event.data
      if (msg.type === 'progress') {
        setState({ kind: 'fitting', coords: msg.coords })
      } else if (msg.type === 'done') {
        setState({ kind: 'ready', coords: msg.coords })
        writeCache(key, msg.coords)
      } else if (msg.type === 'transformed') {
        pendingTransform.current?.(msg.coord)
        pendingTransform.current = null
      } else if (msg.type === 'error') {
        if (pendingTransform.current) {
          pendingTransform.current(null)
          pendingTransform.current = null
        } else {
          fallback(msg.message)
        }
      }
    }
    const nNeighbors = Math.max(1, Math.min(UMAP_PARAMS.nNeighbors, normalised.length - 1))
    try {
      worker.postMessage({ type: 'fit', data: normalised, nNeighbors, minDist: UMAP_PARAMS.minDist, seed: UMAP_PARAMS.seed })
    } catch (e) {
      fallback(e instanceof Error ? e.message : String(e))
    }

    return () => {
      worker.terminate()
      workerRef.current = null
      pendingTransform.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, embeddingVersion, items.length])

  const coords = state.kind === 'idle' || state.kind === 'decoding' ? [] : state.coords
  const { points, scale } = useMemo(() => fitToViewbox(coords, VIEWBOX.width, VIEWBOX.height), [coords])

  const itemIndexById = useMemo(() => new Map(items.map((it, i) => [it.itemId, i])), [items])
  const neighborIds = useMemo(
    () => new Set(neighbors.data.neighbors.map((n) => n.itemId)),
    [neighbors.data.neighbors],
  )

  function select(id: string | null) {
    setStar(null)
    onSelect(id)
  }

  useEffect(() => {
    if (!sel) {
      onInspect(null)
      return
    }
    const item = items.find((it) => it.itemId === sel)
    if (!item) {
      onInspect(null)
      return
    }
    onInspect({
      title: 'Pont részletei',
      content: (
        <MapPointInspectorBody item={item} neighbors={neighbors.data.neighbors} neighborsPending={neighbors.isPending} />
      ),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, items, neighbors.data.neighbors, neighbors.isPending])

  function transform(vector: number[]): Promise<number[] | null> {
    return new Promise((resolve) => {
      if (!workerRef.current || state.kind !== 'ready') {
        resolve(null)
        return
      }
      pendingTransform.current = resolve
      workerRef.current.postMessage({ type: 'transform', vector })
    })
  }

  async function runReplay() {
    const q = query.trim()
    if (!q) return
    const detail = await replay.mutateAsync({ query: q, reranker: false, rewrite: false, consumerPolicy: 'CHAT_AMBIENT' })
    const candidateIds = new Set(
      detail.candidates.map((c) => c.memoryItemId).filter((id): id is string => id != null),
    )
    const matchedCoords = [...candidateIds]
      .map((id) => itemIndexById.get(id))
      .filter((i): i is number => i != null)
      .map((i) => coords[i])
      .filter((c): c is number[] => c != null)

    let placed: number[] | null = null
    let estimated = true
    if (detail.queryProjection && detail.queryProjection.length > 0) {
      const [normalisedQuery] = l2Normalise([detail.queryProjection])
      const transformed = await transform(normalisedQuery)
      if (transformed) {
        placed = transformed
        estimated = false
      }
    }
    if (!placed && matchedCoords.length > 0) {
      const centroid = matchedCoords.reduce(
        (acc, c) => [acc[0] + c[0] / matchedCoords.length, acc[1] + c[1] / matchedCoords.length],
        [0, 0],
      )
      placed = centroid
    }
    setStar(placed ? { coord: placed, estimated, candidateIds } : null)
  }

  if (vectors.data.degraded) {
    return (
      <MosaicDesktop>
        <div className="am-degraded">
          <div className="t">A memória-felfedező ki van kapcsolva</div>
          <p>Ehhez a userhez (vagy ehhez a környezethez) a mezo.feature.admin-memory switch nincs bekapcsolva.</p>
        </div>
      </MosaicDesktop>
    )
  }

  const starPoint = star ? scale(star.coord) : null

  return (
    <MosaicDesktop>
      <AdminTile query={vectors} wash="sky" eyebrow="Térkép" span={12}>
        {vectors.data.sampled && (
          <div className="am-samplebanner">
            {vectors.data.items.length} elem látszik a {vectors.data.total}-ból — a legfrissebb és
            legfontosabb mintája.
          </div>
        )}

        <div className="am-replay" style={{ marginBottom: 10 }}>
          <input
            type="text"
            value={query}
            maxLength={500}
            placeholder="próba-lekérdezés elhelyezése a térképen…"
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="am-toggles">
            <button type="button" className="am-btn" disabled={replay.isPending} onClick={() => void runReplay()}>
              Elhelyezés a térképen
            </button>
          </div>
        </div>

        {state.kind === 'fallback' && (
          <div className="am-caveat" style={{ marginBottom: 10 }}>
            A UMAP nem futott le — az első két főkomponens látszik.
          </div>
        )}

        <div className="am-mapwrap">
          <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} width="100%" style={{ display: 'block' }}>
            {sel &&
              points.length > 0 &&
              itemIndexById.has(sel) &&
              neighbors.data.neighbors.map((n) => {
                const idx = itemIndexById.get(n.itemId)
                if (idx == null) return null
                const from = points[itemIndexById.get(sel)!]
                const to = points[idx]
                if (!from || !to) return null
                return (
                  <line
                    key={`nb-${n.itemId}`}
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={NEIGHBOR_STROKE}
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                )
              })}
            {starPoint && [...(star?.candidateIds ?? [])].map((id) => {
              const idx = itemIndexById.get(id)
              if (idx == null) return null
              const p = points[idx]
              if (!p) return null
              return (
                <line
                  key={`q-${id}`}
                  x1={starPoint.x} y1={starPoint.y} x2={p.x} y2={p.y}
                  stroke={QUERY_STROKE}
                  strokeWidth={1.4}
                  strokeDasharray="3 3"
                />
              )
            })}
            {items.map((item, i) => {
              const p = points[i]
              if (!p) return null
              const color = SOURCE_KIND_COLOR[item.sourceKind] ?? FALLBACK_SOURCE_COLOR
              const hollow = item.state === 'suppressed' || item.state === 'superseded'
              const radius = 3 + item.salience * 6
              const isSelected = item.itemId === sel
              const isNeighbor = neighborIds.has(item.itemId)
              const isCandidate = star?.candidateIds.has(item.itemId) ?? false
              return (
                <circle
                  key={item.itemId}
                  data-testid={`am-point-${item.itemId}`}
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? radius + 3 : radius}
                  fill={hollow ? 'none' : color}
                  stroke={
                    isSelected ? SELECTED_STROKE
                      : isNeighbor ? NEIGHBOR_STROKE
                        : isCandidate ? QUERY_STROKE
                          : hollow ? color : undefined
                  }
                  strokeWidth={isSelected || isNeighbor || isCandidate ? 2.4 : hollow ? 2 : 0}
                  style={{ cursor: 'pointer' }}
                  onClick={() => select(item.itemId)}
                >
                  <title>{item.snippet}</title>
                </circle>
              )
            })}
            {starPoint && (
              <circle
                cx={starPoint.x} cy={starPoint.y} r={9}
                fill="none" stroke={QUERY_STROKE} strokeWidth={2.4}
                data-testid="am-query-star"
              />
            )}
          </svg>
        </div>

        {star && (
          <div className="ad-note9" style={{ fontSize: 9.5, color: '#A2958A', marginTop: 4 }}>
            {star.estimated
              ? 'A lekérdezés helye becsült — a jelöltek térkép-pontjainak súlypontja, nem valódi vetület.'
              : 'A lekérdezés helye a UMAP transform()-jával lett kiszámolva ugyanabból a modellből.'}
          </div>
        )}

        <div className="am-mapkeynote">szín = forrás · méret = fontosság (salience)</div>
        <div className="am-srckey">
          <span><i style={{ background: '#6C5FA3' }} />sleep_log</span>
          <span><i style={{ background: '#7FA06C' }} />food_log / fuel_log</span>
          <span><i style={{ background: '#E1663F' }} />train_session / workout</span>
          <span><i style={{ background: '#4E8FB8' }} />journal_entry / memory_item</span>
          <span><i style={{ background: '#C9962E' }} />habit_day / habit_tick</span>
          <span><i style={{ background: '#C46FA0' }} />chat_message</span>
          <span style={{ opacity: 0.7 }}>
            <i style={{ background: 'transparent', border: '2px solid #6E6257', borderRadius: '50%' }} />
            suppressed / superseded (üres)
          </span>
          <span>
            <i style={{ background: 'transparent', border: `2px solid ${QUERY_STROKE}`, borderRadius: '50%' }} />
            ★ replayed lekérdezés + jelöltjei
          </span>
        </div>

        <div className="ad-note9" style={{ fontSize: 9.5, color: '#A2958A', marginTop: 8 }}>
          A térképen látott távolság a 2D-re hajtogatott vetület, nem a valódi vektor-távolság — a
          jobb oldali panel a pgvector valódi szomszédait mutatja.
        </div>
      </AdminTile>
    </MosaicDesktop>
  )
}
