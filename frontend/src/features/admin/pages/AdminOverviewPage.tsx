import type { ReactNode } from 'react'
import { useMe } from '@/data/hooks'
import { useAdminAlerts, useAdminCostMatrix, useAdminOverview, useAdminUserInsights } from '@/data/admin/adminInsightsHooks'
import { AdminStatusBand } from '@/features/admin/components/AdminStatusBand'
import { AdminTile, type AdminTileQuery } from '@/features/admin/components/AdminTile'
import { Sparkline } from '@/features/admin/components/Sparkline'
import { TopListTile } from '@/features/admin/components/TopListTile'
import { ClaySpot } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MosaicDesktop, MozaikPage, PageBody, PageHero } from '@/shared/ui/mozaik'
import { huInt, usd } from '@/shared/lib/huNum'
import {
  costDeltaCopy,
  costMatrixTotals,
  deltaVsTrailingAvg,
  domainTotals,
  featureLegend,
  quietTesters,
  sumSeriesByDay,
  topNFromEntries,
} from '@/features/admin/lib/adminViz'

// Pulzus — the installation-wide landing (mezo-m079 Task 3), replacing the old Áttekintés
// mosaic. Layout (12-col, in order): status band (sp12) → 4 KPI posters (sp3) → 2 trend tiles
// (sp6) → 3 top-N tiles (sp4). Binding "data honesty" rulings this page must never violate:
//   - Rendszer KPI comes ONLY from the alerts feed — no invented process/health counts.
//   - Memória KPI is counts + a stuck badge, never a fabricated percentage.
//   - Költés ma's Δ is `deltaVsTrailingAvg` against the real cost series, never guessed.
// Several INDEPENDENT queries fire here (overview, alerts, 30d + 7d cost matrix, user insights);
// every tile combining more than one query ORs their isError/isPending into a synthetic
// AdminTileQuery (the "costQuery" recipe already established by the pre-rebuild page) so one
// failing endpoint degrades only the tile(s) that actually depend on it.

const MISSING_MARK = ' (nincs címke)'

export function AdminOverviewPage() {
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const ov = useAdminOverview(isOwner)
  const alerts = useAdminAlerts(isOwner)
  const cm30 = useAdminCostMatrix('30d', isOwner)
  const cm7 = useAdminCostMatrix('7d', isOwner)
  const testers = useAdminUserInsights(null, 'lastActivityAt', 'asc', isOwner)

  const alertsList = alerts.data.alerts
  const worstSeverity: 'bad' | 'warn' | null = alertsList.some((a) => a.severity === 'bad')
    ? 'bad'
    : alertsList.some((a) => a.severity === 'warn') ? 'warn' : null
  const memoryStuck = alertsList.find((a) => a.key === 'memory_stuck')

  const costDelta = deltaVsTrailingAvg(ov.data.costSeries.map((d) => d.amountUsd), 7)
  const domainDailyTotals = sumSeriesByDay(ov.data.domainSeries)

  const memQuery: AdminTileQuery = {
    isError: ov.isError || alerts.isError,
    isPending: ov.isPending || alerts.isPending,
    refetch: () => { ov.refetch(); alerts.refetch() },
  }
  const costTrendQuery: AdminTileQuery = {
    isError: ov.isError || cm30.isError,
    isPending: ov.isPending || cm30.isPending,
    refetch: () => { ov.refetch(); cm30.refetch() },
  }
  const costTopQuery: AdminTileQuery = {
    isError: cm7.isError,
    isPending: cm7.isPending,
    refetch: cm7.refetch,
  }

  const featureTrendLegend = featureLegend(cm30.data, 3)
  const domainLegend = [...domainTotals(ov.data.domainSeries)].sort((a, b) => b.value - a.value)

  const kikViszikRows = topNFromEntries(costMatrixTotals(cm7.data, 'user'), 5, usd).map((row) => ({
    ...row,
    // '__background__' is the Háttér (cron) bucket, not a real user page to drill into.
    to: row.key === '__background__' ? undefined : `/admin/users/${row.key}`,
  }))
  const mireMegyRows = topNFromEntries(costMatrixTotals(cm7.data, 'feature'), 5, usd)
  const quietRows = quietTesters(testers.data)

  return (
    <MozaikPage tone="sky">
      <PageHero name="Pulzus" sub="a telepítés életjelei" />
      <PageBody>
        <EntranceGroup>
          <MosaicDesktop>
            <AdminStatusBand />

            <AdminTile query={alerts} wash={worstSeverity ? 'coral' : 'sage'} eyebrow="Rendszer" span={3}>
              {alertsList.length === 0 ? (
                <div className="ad-cell" style={{ justifyContent: 'space-between' }}>
                  <SystemOkRing />
                  <span className="ad-mut">Nincs figyelmeztetés</span>
                </div>
              ) : (
                <div className="ad-poster">
                  <div className="ad-big">{huInt(alertsList.length)}<u>{alertsList.length === 1 ? 'figyelmeztetés' : 'figyelmeztetés'}</u></div>
                  <div className="foot"><span className={`ad-tag ${worstSeverity}`}>{worstSeverity === 'bad' ? 'kritikus' : 'figyelem'}</span></div>
                </div>
              )}
            </AdminTile>

            <AdminTile query={ov} wash="gold" eyebrow="Költés ma" span={3}>
              <Poster spot="s-medal" big={usd(ov.data.costTodayUsd)} unit=""
                foot={<span className={`ad-delta ${costDelta.direction}`}>{costDeltaCopy(costDelta)}</span>} />
            </AdminTile>

            <AdminTile query={ov} wash="coral" eyebrow="Aktív ma" span={3}>
              <Poster spot="s-energia" big={huInt(ov.data.activeToday)} unit={`/ ${ov.data.userCount}`}
                foot={<span className="ad-mut">7 nap: {ov.data.active7d} · 30 nap: {ov.data.active30d}</span>} />
            </AdminTile>

            <AdminTile query={memQuery} wash="lav" eyebrow="Memória" span={3}>
              <Poster spot="s-hajtas" big={huInt(ov.data.memoryItemCount)} unit="emlék"
                foot={<>
                  <span className="ad-mut">{huInt(ov.data.vectorCount)} vektor</span>
                  {memoryStuck && <span className="ad-tag bad">elakadva</span>}
                </>} />
            </AdminTile>

            <AdminTile query={costTrendQuery} wash="gold" eyebrow="Költés 30 nap" span={6}>
              <div className="ad-cell" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div className="ad-big">{usd(cm30.data.totalUsd)}<u>összesen</u></div>
                <ClaySpot name="s-hegycel" size={48} />
              </div>
              <Sparkline points={ov.data.costSeries.map((d) => d.amountUsd)} tone="gold" ariaLabel="Költés 30 nap" />
              <div className="ad-legend">
                {featureTrendLegend.map((slice, i) => (
                  <span key={slice.key}>
                    <i style={{ background: LEGEND_COLORS_GOLD[i % LEGEND_COLORS_GOLD.length] }} />
                    {slice.label}{slice.missing && MISSING_MARK} · {usd(slice.value)}
                  </span>
                ))}
              </div>
            </AdminTile>

            <AdminTile query={ov} wash="sage" eyebrow="Aktivitás 30 nap" span={6}>
              <div className="ad-cell" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div className="ad-big">{huInt(domainDailyTotals.reduce((a, b) => a + b, 0))}<u>sor</u></div>
                <ClaySpot name="s-edzes" size={48} />
              </div>
              <Sparkline points={domainDailyTotals} tone="sage" ariaLabel="Aktivitás 30 nap" />
              <div className="ad-legend">
                {domainLegend.map((entry, i) => (
                  <span key={entry.key}>
                    <i style={{ background: LEGEND_COLORS_SAGE[i % LEGEND_COLORS_SAGE.length] }} />
                    {entry.label}{entry.missing && MISSING_MARK} · {huInt(entry.value)}
                  </span>
                ))}
              </div>
            </AdminTile>

            <AdminTile query={costTopQuery} wash="coral" eyebrow="Kik viszik a költést · 7 nap" span={4}>
              <TopListTile
                title="Kik viszik a költést · 7 nap"
                rows={kikViszikRows}
                moreLabel="Minden fiók megnézése →"
                moreTo="/admin/users"
              />
            </AdminTile>

            <AdminTile query={costTopQuery} wash="gold" eyebrow="Mire megy a pénz · 7 nap" span={4}>
              <TopListTile
                title="Mire megy a pénz · 7 nap"
                rows={mireMegyRows}
                moreLabel="Teljes költség-bontás →"
                moreTo="/admin/cost"
              />
            </AdminTile>

            <AdminTile query={testers} wash="sky" eyebrow="Csendes tesztelők" span={4}>
              <TopListTile
                title="Csendes tesztelők"
                rows={quietRows}
                emptyLabel="Mindenki járt itt mostanában."
                moreLabel="Minden tesztelő aktivitása →"
                moreTo="/admin/users"
              />
            </AdminTile>
          </MosaicDesktop>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

const LEGEND_COLORS_GOLD = ['#C9962E', '#D9A64B', '#E8C27A', '#A2958A']
const LEGEND_COLORS_SAGE = ['#6E8B5E', '#8CA97C', '#AFC79E', '#A2958A']

function Poster({ spot, big, unit, foot }: { spot: Parameters<typeof ClaySpot>[0]['name']; big: string; unit: string; foot: ReactNode }) {
  return (
    <div className="ad-poster">
      <div className="ad-spot spot"><ClaySpot name={spot} size={44} /></div>
      <div className="ad-big">{big}{unit && <u>{unit}</u>}</div>
      <div className="foot">{foot}</div>
    </div>
  )
}

/** The Rendszer KPI's "all clear" state — a fully-drawn sage ring, no percentage text (the
 *  honesty ruling forbids an invented number here; the ring is a plain boolean visual, not a
 *  metric). Mirrors AdminUserDetailPage's `.ad-ring` gauge markup, at 100% arc / off = 0. */
function SystemOkRing({ size = 56 }: { size?: number }) {
  const r = size / 2 - 7
  const c = 2 * Math.PI * r
  return (
    <div className="ad-ring" style={{ '--c': c.toFixed(1), '--off': '0' } as React.CSSProperties}>
      <svg width={size} height={size}>
        <circle className="trk" cx={size / 2} cy={size / 2} r={r} strokeWidth={7} />
        <circle className="arc" cx={size / 2} cy={size / 2} r={r} stroke="#4E6B42" strokeWidth={7} />
      </svg>
      <div className="mid"><ClaySpot name="s-medal" size={22} /></div>
    </div>
  )
}
