import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMe } from '@/data/hooks'
import { useAdminUserDetail } from '@/data/admin/adminInsightsHooks'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { MemorySegmentBar, VIEWS, type ViewKey } from '@/features/admin/memory/MemorySegmentBar'
import { InspectorEmpty, MemoryInspector } from '@/features/admin/memory/MemoryInspector'
import { RunsView } from '@/features/admin/memory/views/RunsView'
import { GraphView } from '@/features/admin/memory/views/GraphView'
import { MapView } from '@/features/admin/memory/views/MapView'
import { LayersView } from '@/features/admin/memory/views/LayersView'
import type { InspectorBody } from '@/features/admin/memory/views/RunDetail'

// /admin/users/:id/memory?view=runs|graph|map|layers&sel=<id>
// The view and the selection live in the URL, not in component state (mezo-4qyt.3): a deep
// link from a run candidate to "this edge on Gráf" or "this point on Térkép" is the whole point
// of the four views sharing one inspector, and that only works if both are addressable.
//
// This page owns URL state, the 5-tab bar (mirroring AdminUserDetailPage's TABS with "Memória"
// selected — the other four navigate back to the user detail page, same idiom that page already
// uses for ITS "Memória" tab), the segment bar, and the shared inspector; every view supplies
// its own inspector body via `onInspect`.
const TABS = ['Aktivitás', 'Adatok', 'Feature-ök', 'Költség', 'Memória'] as const

export function AdminMemoryPage() {
  const { id = '' } = useParams()
  const userId = id
  const navigate = useNavigate()
  const isOwner = useMe().data?.role === 'OWNER'
  const detail = useAdminUserDetail(userId, isOwner)
  const [params, setParams] = useSearchParams()
  const rawView = params.get('view')
  const view = (rawView != null && rawView in VIEWS ? rawView : 'runs') as ViewKey
  const sel = params.get('sel')
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const [inspector, setInspector] = useState<InspectorBody | null>(null)

  // A stale inspector body from the PREVIOUS view (e.g. a run candidate) must not survive a
  // view switch — the new view starts from its own empty state until it selects something.
  useEffect(() => { setInspector(null) }, [view])

  const select = (next: string | null) => {
    const p = new URLSearchParams(params)
    if (next) p.set('sel', next)
    else p.delete('sel')
    setParams(p, { replace: true })
  }

  const go = (next: ViewKey, nextSel: string | null = null) => {
    const p = new URLSearchParams(params)
    p.set('view', next)
    if (nextSel) p.set('sel', nextSel)
    else p.delete('sel')
    setParams(p)
  }

  const user = detail.data.user

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={() => navigate(`/admin/users/${userId}`)} />
      <PageBody>
        <div className="ad-hero">
          <span className="ad-avatar lg" style={{ background: '#6C5FA3' }}>
            {(user.name || '?').charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="nm">{user.name || '—'}</div>
            <div className="em">{user.email}</div>
          </div>
          <div className="stats">
            <div><span className="v">{user.rowCount}</span><span className="ad-eyebrow">sor</span></div>
            <div><span className="v">{user.vectorCount}</span><span className="ad-eyebrow">vektor</span></div>
          </div>
        </div>

        <div className="ad-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === 'Memória'}
              className={`ad-tab${t === 'Memória' ? ' on' : ''}`}
              onClick={() => { if (t !== 'Memória') navigate(`/admin/users/${userId}`) }}
            >
              {t}
            </button>
          ))}
        </div>

        <MemorySegmentBar active={view} onSelect={(v) => go(v)} />

        <div className="am-layout">
          <div className="am-content">
            {view === 'runs' && (
              <RunsView
                userId={userId}
                isOwner={isOwner}
                selectedRunId={sel}
                onSelectRun={select}
                onGo={go}
                onInspect={setInspector}
              />
            )}
            {view === 'graph' && (
              <GraphView userId={userId} isOwner={isOwner} sel={sel} onSelect={select} onInspect={setInspector} />
            )}
            {view === 'map' && <MapView />}
            {view === 'layers' && <LayersView />}
          </div>

          <MemoryInspector
            title={inspector?.title ?? 'Részletek'}
            collapsed={inspectorCollapsed}
            onToggleCollapse={() => setInspectorCollapsed((c) => !c)}
          >
            {inspector ? inspector.content : <InspectorEmpty />}
          </MemoryInspector>
        </div>
      </PageBody>
    </MozaikPage>
  )
}
