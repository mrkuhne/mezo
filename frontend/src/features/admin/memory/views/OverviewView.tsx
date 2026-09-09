import { useAdminUserFeedback } from '@/data/admin/adminInsightsHooks'
import { useAdminMemoryHealth } from '@/data/admin/adminMemoryHooks'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { MosaicDesktop } from '@/shared/ui/mozaik'
import { huInt } from '@/shared/lib/huNum'
import type { ViewKey } from '@/features/admin/memory/MemorySegmentBar'
import type { AdminMemoryCountBucket } from '@/data/admin/adminMemoryApi'

// Áttekintés (mezo-k5zy Task 2) — the memory explorer's new default landing view: a per-user
// health summary (the SAME `/health` read Rétegek already uses — no new endpoint), the recall
// quality line (verbatim recipe borrowed from AdminUserDetailPage's Visszajelzések tab, since it
// is the exact same `useAdminUserFeedback` shape and honesty guard), and a "last problems" strip
// whose failed/stale counts are a deep link into Rétegek (`onGo('layers', null)`), not a filter —
// same "the number is the guide, not a filter" idiom Rétegek itself uses for the data browser.
//
// No `onInspect` prop: like Rétegek, this view has no selectable row, so the shared inspector
// stays on its collapsible empty placeholder.

function countOf(buckets: AdminMemoryCountBucket[], key: string): number {
  return buckets.find((b) => b.key === key)?.count ?? 0
}

function sumOf(buckets: AdminMemoryCountBucket[]): number {
  return buckets.reduce((acc, b) => acc + b.count, 0)
}

export function OverviewView({
  userId,
  isOwner,
  onGo,
}: {
  userId: string
  isOwner: boolean
  onGo: (view: ViewKey, sel: string | null) => void
}) {
  const health = useAdminMemoryHealth(userId, isOwner)
  const feedback = useAdminUserFeedback(userId, isOwner)
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

  const readyCount = countOf(h.vectorsByStatus, 'ready')
  const failedCount = countOf(h.vectorsByStatus, 'failed')
  const staleCount = h.staleVectorCount
  const itemsTotal = sumOf(h.itemsByState)

  const recall = feedback.data.recall
  const recallTotal = recall ? recall.useful + recall.irrelevant : 0

  return (
    <MosaicDesktop>
      <AdminTile query={health} wash="sky" eyebrow="Emlék-egészség" span={6}>
        <div className="am-statgrid" style={{ marginTop: 8 }}>
          <div className="am-stat"><b>{huInt(readyCount)}</b><div className="lbl">kész vektor</div></div>
          <button type="button" className="am-stat linkable" onClick={() => onGo('layers', null)}>
            <b>{huInt(failedCount)}</b><div className="lbl">elakadt vektor</div>
          </button>
          <button type="button" className="am-stat linkable" onClick={() => onGo('layers', null)}>
            <b>{huInt(staleCount)}</b><div className="lbl">elavult vektor</div>
          </button>
          <div className="am-stat"><b>{huInt(itemsTotal)}</b><div className="lbl">emlék összesen</div></div>
        </div>
      </AdminTile>

      <AdminTile query={feedback} wash="rose" eyebrow="Felidézés-minőség" span={6}>
        {recall !== null && recallTotal > 0 ? (
          <>
            <p>A felidézett emlékek {Math.round((100 * recall.useful) / recallTotal)}%-a volt hasznos.</p>
            <p className="ad-mut">elnémítva: {huInt(recall.suppress)}</p>
          </>
        ) : (
          <p className="ad-mut">Még nincs elég emlék-felidézési visszajelzés.</p>
        )}
      </AdminTile>

      <AdminTile query={health} wash="coral" eyebrow="Legutóbbi problémák" span={12}>
        {failedCount === 0 && staleCount === 0 ? (
          <p className="ad-mut">Nincs sikertelen vagy elavult vektor.</p>
        ) : (
          <div className="ad-cell" style={{ gap: 16 }}>
            {failedCount > 0 && (
              <button type="button" className="ad-fk" onClick={() => onGo('layers', null)}>
                {huInt(failedCount)} sikertelen vektor a Rétegeken →
              </button>
            )}
            {staleCount > 0 && (
              <button type="button" className="ad-fk" onClick={() => onGo('layers', null)}>
                {huInt(staleCount)} elavult vektor a Rétegeken →
              </button>
            )}
          </div>
        )}
      </AdminTile>
    </MosaicDesktop>
  )
}
