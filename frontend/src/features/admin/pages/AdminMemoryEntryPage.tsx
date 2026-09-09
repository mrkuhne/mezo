import { Link } from 'react-router-dom'
import { useMe } from '@/data/hooks'
import { useAdminUserInsights } from '@/data/admin/adminInsightsHooks'
import { useAdminMemoryGlobalHealth } from '@/data/admin/adminMemoryHooks'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { ClaySpot } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MosaicDesktop, MozaikPage, PageBody, PageHero } from '@/shared/ui/mozaik'
import { huInt } from '@/shared/lib/huNum'

// Memória entry page (mezo-k5zy Task 2) — the rail's new `/admin/memory` landing: install-wide
// health KPIs (from the NEW `getAdminMemoryHealth` op, Task 1 — NOT a client-side aggregation
// over every user's per-user `/health`, see that hook's own doc comment) + a tester picker that
// jumps straight into a given user's memory explorer. One companion-off gate for the WHOLE page:
// the global-health read degrades exactly like every per-user memory read (`ADMIN_MEMORY_*` 404
// idiom), and the KPI posters are meaningless without it, so a degraded read blanks the entire
// KPI row (not per-poster) — the tester picker below still works since it depends on a
// completely different, non-degradable endpoint (`useAdminUserInsights`).
//
// "Utolsó éjszakai feldolgozás" (`newestDailySummaryAt`) renders as a relative "X órája" — see
// `hoursSinceLabel` below, exported so its warn threshold (>26h — the nightly job's own SLO, one
// run per ~24h plus slack) is unit-tested directly rather than only through a fixed-clock
// component test.

export function hoursSinceLabel(iso: string | null | undefined, now: Date = new Date()): { text: string; warnHours: boolean } {
  if (!iso) return { text: 'még nem futott', warnHours: false }
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return { text: 'még nem futott', warnHours: false }
  const hours = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 3_600_000))
  return { text: `${huInt(hours)} órája`, warnHours: hours > 26 }
}

export function AdminMemoryEntryPage() {
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const health = useAdminMemoryGlobalHealth(isOwner)
  const testers = useAdminUserInsights(null, 'lastActivityAt', 'desc', isOwner)

  const h = health.data
  const lastRun = hoursSinceLabel(h.newestDailySummaryAt)

  return (
    <MozaikPage tone="lav">
      <PageHero name="Memória" sub="a telepítés emlék-egészsége" />
      <PageBody>
        <EntranceGroup>
          <MosaicDesktop>
            {h.degraded ? (
              <AdminTile query={health} wash="lav" eyebrow="Emlék-egészség" span={12}>
                <p className="ad-mut">A memória-felfedező ki van kapcsolva ezen a telepítésen.</p>
              </AdminTile>
            ) : (
              <>
                <AdminTile query={health} wash="sage" eyebrow="Kész vektorok" span={3}>
                  <Poster spot="s-medal" big={huInt(h.vectorsReady)} unit="vektor" />
                </AdminTile>
                <AdminTile query={health} wash="coral" eyebrow="Elakadt vektorok" span={3}>
                  <Poster spot="s-hajtas" big={huInt(h.vectorsFailed)} unit="vektor" />
                </AdminTile>
                <AdminTile query={health} wash="gold" eyebrow="Elavult vektorok" span={3}>
                  <Poster spot="s-napzaras" big={huInt(h.vectorsStale)} unit="vektor" />
                </AdminTile>
                <AdminTile query={health} wash="sky" eyebrow="Emlékek összesen" span={3}>
                  <Poster spot="s-hegycel" big={huInt(h.itemsTotal)} unit="emlék" />
                </AdminTile>

                <AdminTile query={health} wash="white" eyebrow="Utolsó éjszakai feldolgozás" span={12}>
                  <div className="ad-cell" style={{ justifyContent: 'space-between' }}>
                    <span className={lastRun.warnHours ? 'ad-tag warn' : 'ad-mut'} style={{ fontSize: 13, fontWeight: 700 }}>
                      {lastRun.text}
                    </span>
                    {lastRun.warnHours && <span className="ad-mut">a napi összegzés a szokásosnál régebben futott</span>}
                  </div>
                </AdminTile>
              </>
            )}

            <AdminTile query={testers} wash="lav" eyebrow="Tesztelők" span={12}>
              {testers.data.length === 0 ? (
                <p className="ad-mut">Még nincs egy tesztelő sem.</p>
              ) : (
                <div className="ad-memtesterlist">
                  {testers.data.map((u) => (
                    <Link key={u.id} to={`/admin/users/${u.id}/memory`} className="ad-memtesterrow">
                      <span className="ad-avatar" style={{ background: '#6C5FA3' }}>
                        {(u.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <div className="nm">
                        <div className="t">{u.name}</div>
                        <div className="em">{u.email}</div>
                      </div>
                      <span className="ad-mut">{huInt(u.vectorCount)} vektor</span>
                      <span className="chev" aria-hidden="true">›</span>
                    </Link>
                  ))}
                </div>
              )}
            </AdminTile>
          </MosaicDesktop>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

function Poster({ spot, big, unit }: { spot: Parameters<typeof ClaySpot>[0]['name']; big: string; unit: string }) {
  return (
    <div className="ad-poster">
      <div className="ad-spot spot"><ClaySpot name={spot} size={44} /></div>
      <div className="ad-big">{big}<u>{unit}</u></div>
    </div>
  )
}
