import { Link } from 'react-router-dom'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { MosaicDesktop } from '@/shared/ui/mozaik'
import { useAdminMemoryHealth } from '@/data/admin/adminMemoryHooks'
import { huInt } from '@/shared/lib/huNum'
import type { AdminMemoryCountBucket } from '@/data/admin/adminMemoryApi'

// Rétegek (mezo-4qyt.6) — vector/graph health rollups, driven by `/health` ALONE (resolved
// ambiguity 7): no L0–L3 overview cards here. `MemoryObservatoryService.overview(userId)` has no
// admin-facing endpoint yet, and adding one this late would smuggle an eighth contract path into
// the last slice — that is the follow-up "`GET …/memory/overview`" instead. This view only shows
// the raw rollups: memory_vector by status/failure/version, staleness, memory_item by state,
// knowledge_node by status, the edge-weight histogram, and the (estimated) nightly job times.
//
// Every failed/stale/candidate/deleted count is a LINK into part 1's data browser, table
// pre-selected — the count is the guide, not a filter the data browser itself supports.
// The Rétegek view has no selectable row, so it never calls `onInspect` — the shared inspector
// stays the collapsible empty placeholder (`InspectorEmpty`), same as the prototype's aside.

const dataBrowserLink = (userId: string, table: string) =>
  `/admin/data?table=${encodeURIComponent(table)}&userId=${encodeURIComponent(userId)}`

function sumOf(buckets: AdminMemoryCountBucket[]): number {
  return buckets.reduce((acc, b) => acc + b.count, 0)
}

function countOf(buckets: AdminMemoryCountBucket[], key: string): number {
  return buckets.find((b) => b.key === key)?.count ?? 0
}

const VERSION_COLORS = ['#4E8FB8', '#C9962E', '#A2958A', '#5D4FA0', '#6E8B5E']

/** A single cell in the `.am-statgrid` recipe — plain when `to` is absent, a linked data-browser
 *  jump (`.am-stat.linkable`) when it is. */
function Stat({ value, label, to }: { value: number; label: string; to?: string }) {
  const inner = (
    <>
      <b>{huInt(value)}</b>
      <div className="lbl">{label}</div>
    </>
  )
  return to ? (
    <Link to={to} className="am-stat linkable">
      {inner}
    </Link>
  ) : (
    <div className="am-stat">{inner}</div>
  )
}

/** An `.am-joblist` row — plain, or a linked key (the `candidate`/`deleted` states) when a
 *  matching data-browser table is given. */
function JobRow({ label, value, to }: { label: string; value: number; to?: string }) {
  return (
    <div className="row">
      {to ? (
        <Link
          to={to}
          style={{ all: 'unset', cursor: 'pointer', color: '#A84A26', textDecoration: 'underline dotted' }}
        >
          {label}
        </Link>
      ) : (
        <span>{label}</span>
      )}
      <b>{huInt(value)}</b>
    </div>
  )
}

function formatEstimatedTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleString('hu-HU', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · becsült`
}

const JOB_ROWS: { key: string; label: string }[] = [
  { key: 'lastPatternDetection', label: 'minta-felismerés' },
  { key: 'lastEdgeReinforcement', label: 'él-megerősítés (decay + prune)' },
  { key: 'lastDailySummary', label: 'napi összegzés' },
  { key: 'lastVectorWrite', label: 'utolsó vektor-írás (elavult jelölés)' },
  { key: 'lastRetrievalRun', label: 'utolsó lekérdezés' },
]

export function LayersView({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const health = useAdminMemoryHealth(userId, isOwner)
  const h = health.data

  if (h.degraded) {
    return (
      <MosaicDesktop>
        <div className="am-degraded">
          <div className="t">A memória-felfedező ki van kapcsolva</div>
          <p>Ehhez a userhez (vagy ehhez a környezethez) a mezo.feature.admin-memory switch nincs bekapcsolva.</p>
        </div>
      </MosaicDesktop>
    )
  }

  const statusTotal = sumOf(h.vectorsByStatus)
  const staleCount = h.staleVectorCount
  const failedCount = countOf(h.vectorsByStatus, 'failed')
  const okCount = countOf(h.vectorsByStatus, 'ready')
  const versionTotal = sumOf(h.vectorsByVersion) || 1
  const candidateNodes = countOf(h.nodesByStatus, 'candidate')
  const deletedNodes = countOf(h.nodesByStatus, 'deleted')
  const candidateItems = countOf(h.itemsByState, 'candidate')
  const deletedItems = countOf(h.itemsByState, 'deleted')
  const histMax = Math.max(1, ...h.edgeWeightHistogram.map((b) => b.count))

  return (
    <MosaicDesktop>
      <AdminTile query={health} wash="sky" eyebrow="memory_vector · státusz szerint" span={6}>
        <div className="am-statgrid" style={{ marginTop: 8 }}>
          <Stat value={okCount} label="ok" />
          <Stat value={staleCount} label="elavult (stale)" to={dataBrowserLink(userId, 'memory_vector')} />
          <Stat value={failedCount} label="sikertelen" to={dataBrowserLink(userId, 'memory_vector')} />
          <Stat value={statusTotal} label="összesen" />
        </div>

        {h.vectorFailures.length > 0 && (
          <>
            <div className="ad-eyebrow" style={{ marginTop: 12 }}>
              hibakód szerint
            </div>
            <div className="am-joblist" style={{ marginTop: 8 }}>
              {h.vectorFailures.map((f) => (
                <JobRow key={f.key} label={f.key} value={f.count} to={dataBrowserLink(userId, 'memory_vector')} />
              ))}
            </div>
          </>
        )}

        <div className="ad-eyebrow" style={{ marginTop: 12 }}>
          embedding-verzió eloszlás{h.servingEmbeddingVersion ? ` · aktív: ${h.servingEmbeddingVersion}` : ''}
        </div>
        <div className="ad-bar" style={{ width: '100%', marginTop: 6 }}>
          {h.vectorsByVersion.map((v, i) => (
            <i
              key={v.key}
              style={{ background: VERSION_COLORS[i % VERSION_COLORS.length], width: `${(v.count / versionTotal) * 100}%` }}
            />
          ))}
        </div>
        <div className="am-legend2" style={{ marginTop: 6 }}>
          {h.vectorsByVersion.map((v, i) => (
            <span key={v.key}>
              <i style={{ background: VERSION_COLORS[i % VERSION_COLORS.length] }} />
              {v.key} · {huInt(v.count)}
            </span>
          ))}
        </div>
      </AdminTile>

      <AdminTile query={health} wash="coral" eyebrow="memory_item · állapot szerint" span={6}>
        <div className="am-joblist" style={{ marginTop: 8 }}>
          {h.itemsByState.map((s) => (
            <JobRow
              key={s.key}
              label={s.key}
              value={s.count}
              to={s.key === 'candidate' || s.key === 'deleted' ? dataBrowserLink(userId, 'memory_item') : undefined}
            />
          ))}
        </div>
      </AdminTile>

      <AdminTile query={health} wash="lav" eyebrow="knowledge_node · státusz szerint" span={6}>
        <div className="am-joblist" style={{ marginTop: 8 }}>
          {h.nodesByStatus.map((s) => (
            <JobRow
              key={s.key}
              label={s.key}
              value={s.count}
              to={s.key === 'candidate' || s.key === 'deleted' ? dataBrowserLink(userId, 'knowledge_node') : undefined}
            />
          ))}
        </div>
      </AdminTile>

      <AdminTile query={health} wash="sage" eyebrow="él-súly hisztogram · 10 sáv" span={6}>
        <div className="am-histobar" style={{ marginTop: 10 }}>
          {h.edgeWeightHistogram.map((b) => (
            <i key={b.key} style={{ height: `${Math.max(3, (b.count / histMax) * 100)}%` }} title={`${b.key}: ${b.count}`} />
          ))}
        </div>
        <div className="ad-axis" style={{ marginTop: 6 }}>
          <span>0.0</span>
          <span>0.5</span>
          <span>1.0</span>
        </div>
      </AdminTile>

      <AdminTile query={health} wash="white" eyebrow="Éjszakai jobok" span={12}>
        <span className="ad-mut" style={{ fontWeight: 600 }}>
          (időpontok becsültek)
        </span>
        <div className="am-joblist" style={{ marginTop: 8, gridTemplateColumns: '1fr 1fr', display: 'grid' }}>
          {JOB_ROWS.map((j) => (
            <div className="row" key={j.key}>
              <span>{j.label}</span>
              <b>{formatEstimatedTimestamp((h.jobs as Record<string, string | null | undefined>)[j.key])}</b>
            </div>
          ))}
        </div>
      </AdminTile>

      <div className="ad-note9" style={{ fontSize: 9.5, color: '#A2958A', marginTop: 10 }}>
        Minden hibás/elavult szám ({huInt(staleCount)} elavult, {huInt(failedCount)} sikertelen,{' '}
        {huInt(candidateItems)} + {huInt(candidateNodes)} candidate, {huInt(deletedItems)} + {huInt(deletedNodes)}{' '}
        deleted) az adatböngészőbe mutat, a megfelelő táblára és userre előszűrve — a szám csak a nyom, nem szűrő.
      </div>
    </MosaicDesktop>
  )
}
