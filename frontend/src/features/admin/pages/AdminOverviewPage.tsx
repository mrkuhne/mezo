import type { ReactNode } from 'react'
import { useMe } from '@/data/hooks'
import { useAdminCostMatrix, useAdminOverview } from '@/data/admin/adminInsightsHooks'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { Sparkline } from '@/features/admin/components/Sparkline'
import { ClaySpot } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MosaicDesktop, MozaikPage, PageBody, PageHero } from '@/shared/ui/mozaik'
import { huInt } from '@/shared/lib/huNum'

// Áttekintés — the installation-wide overview (mezo-d5iy.11), ported from admin-body.html's
// #d-overview: four poster StatCells, two sp6 sparkline tiles, one sp12 cost sparkline.
//
// Two INDEPENDENT queries fire here (the spec's "per-tile error isolation" requirement needs
// more than one query to even be testable): `useAdminOverview` covers the counters/domain/
// activity series, `useAdminCostMatrix` is the sole source of the 30-day cost TOTAL (the
// prototype's own comment: "a 30 napos összköltség egyetlen forrása — a költség-mátrixban" —
// summing `costSeries` would double-count differently from the cost matrix's cell sum). A tile
// that needs both degrades if EITHER fails; every other tile only depends on the overview query.
const usd = (v: number) => `$${v.toFixed(2)}`

export function AdminOverviewPage() {
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const ov = useAdminOverview(isOwner)
  const cm = useAdminCostMatrix('30d', isOwner)

  const loggedTotal = Object.values(ov.data.loggedToday).reduce((a, b) => a + b, 0)
  const domainDailyTotals = sumSeriesByDay(ov.data.domainSeries)
  const costQuery = {
    isError: ov.isError || cm.isError,
    isPending: ov.isPending || cm.isPending,
    refetch: () => { ov.refetch(); cm.refetch() },
  }

  return (
    <MozaikPage tone="sky">
      <PageHero name="Áttekintés" sub="a telepítés egésze" />
      <PageBody>
        <EntranceGroup>
          <MosaicDesktop>
            <AdminTile query={ov} wash="sky" eyebrow="Userek" span={3}>
              <Poster spot="s-en" big={huInt(ov.data.userCount)} unit="fiók"
                foot={<span className="ad-mut">7 nap: {ov.data.active7d} · 30 nap: {ov.data.active30d}</span>} />
            </AdminTile>

            <AdminTile query={ov} wash="coral" eyebrow="Aktív ma" span={3}>
              <Poster spot="s-energia" big={huInt(ov.data.activeToday)} unit={`/ ${ov.data.userCount}`}
                foot={<span className="ad-mut">7 nap: {ov.data.active7d} · 30 nap: {ov.data.active30d}</span>} />
            </AdminTile>

            <AdminTile query={ov} wash="sage" eyebrow="Logolva ma" span={3}>
              <Poster spot="s-napzaras" big={huInt(loggedTotal)} unit="sor"
                foot={<span className="ad-mut">domének összesen</span>} />
            </AdminTile>

            <AdminTile query={costQuery} wash="gold" eyebrow="Költség ma" span={3}>
              <Poster spot="s-medal" big={usd(ov.data.costTodayUsd)} unit=""
                foot={<span className="ad-mut">30 nap: {usd(cm.data.totalUsd)}</span>} />
            </AdminTile>

            <AdminTile query={ov} wash="coral" eyebrow="Aktív userek · 30 nap" span={6}>
              <div className="ad-cell" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div className="ad-big">{huInt(peak(ov.data.activeUserSeries.map((d) => d.count)))}<u>csúcs</u></div>
                <ClaySpot name="s-hajtas" size={48} />
              </div>
              <Sparkline points={ov.data.activeUserSeries.map((d) => d.count)} tone="coral" ariaLabel="Aktív userek · 30 nap" />
            </AdminTile>

            <AdminTile query={ov} wash="sage" eyebrow="Logolt sorok · 30 nap" span={6}>
              <div className="ad-cell" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div className="ad-big">{huInt(domainDailyTotals.reduce((a, b) => a + b, 0))}<u>sor</u></div>
                <ClaySpot name="s-edzes" size={48} />
              </div>
              <Sparkline points={domainDailyTotals} tone="sage" ariaLabel="Logolt sorok · 30 nap" />
            </AdminTile>

            <AdminTile query={costQuery} wash="gold" eyebrow="LLM költség · napi, 30 nap" span={12}>
              <div className="ad-cell" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div className="ad-big">{usd(cm.data.totalUsd)}<u>összesen · napi átlag {usd(cm.data.totalUsd / 30)}</u></div>
                <ClaySpot name="s-hegycel" size={54} />
              </div>
              <Sparkline points={ov.data.costSeries.map((d) => d.amountUsd)} tone="gold" ariaLabel="LLM költség · napi, 30 nap" />
              <div className="ad-legend">
                <span><i style={{ background: '#C9962E' }} />napi költség</span>
                <span className="ad-mut">ma: {usd(ov.data.costTodayUsd)}</span>
              </div>
            </AdminTile>
          </MosaicDesktop>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

function sumSeriesByDay(series: { days: { count: number }[] }[]): number[] {
  if (series.length === 0) return []
  const n = series[0].days.length
  return Array.from({ length: n }, (_, i) => series.reduce((sum, s) => sum + (s.days[i]?.count ?? 0), 0))
}

function peak(vals: number[]): number {
  return vals.length ? Math.max(...vals) : 0
}

function Poster({ spot, big, unit, foot }: { spot: Parameters<typeof ClaySpot>[0]['name']; big: string; unit: string; foot: ReactNode }) {
  return (
    <div className="ad-poster">
      <div className="ad-spot spot"><ClaySpot name={spot} size={44} /></div>
      <div className="ad-big">{big}{unit && <u>{unit}</u>}</div>
      <div className="foot">{foot}</div>
    </div>
  )
}
