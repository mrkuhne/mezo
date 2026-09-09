import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMe } from '@/data/hooks'
import { useLlmUsageBreakdown, useLlmUsageSummary, useLlmCalls } from '@/data/me/llmUsageHooks'
import { useAdminCostMatrix, useAdminOverview, useAdminUserInsights } from '@/data/admin/adminInsightsHooks'
import { AiCallFilters } from '@/features/admin/components/AiCallFilters'
import { AiCallRow } from '@/features/admin/components/AiCallRow'
import { AiModelBreakdown } from '@/features/admin/components/AiModelBreakdown'
import { AdminTile, type AdminTileQuery } from '@/features/admin/components/AdminTile'
import { Sparkline } from '@/features/admin/components/Sparkline'
import { TopListTile, type TopRow } from '@/features/admin/components/TopListTile'
import { featureLabel } from '@/features/admin/lib/labels'
import { heatColor, monthRunRate, spikeDays, topNFromEntries, type AdminVizEntry } from '@/features/admin/lib/adminViz'
import { GhostState } from '@/shared/ui/GhostState'
import { ClaySpot } from '@/shared/ui/clay'
import { CollapsibleStrip, MosaicDesktop, MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { huInt, usd } from '@/shared/lib/huNum'
import type { LlmCallFilters as Filters } from '@/data/me/llmUsageApi'

// Költés section rebuild (mezo-pfdv Task 2) — replaces the mobile-shaped period-tab page with
// the section template: KPI strip (calendar-month spend) → top-5 cards → model-mix table →
// 30d trend with anomaly dots → the call list (now URL-param-driven) → a cost-matrix toggle.
//
// URL-as-state: `?day=`, `?feature=`, `?status=`, `?user=` are the SOURCE OF TRUTH for the call
// list's filters — every chip/dot writes into `useSearchParams`, never into local component
// state, so a deep link (the Pulzus alerts' `/admin/cost?day=…`/`?feature=…`) lands filtered on
// first render, not after a click. `callKind` stays local component state — the plan's Rulings
// only name day/feature/status/user as the deep-link contract.
//
// Calendar vs rolling windows (plan Rulings, never mixed in one tile): the KPI strip and the
// model-mix table read the CALENDAR month (`useLlmUsageSummary`/`useLlmUsageBreakdown('MONTH')`
// — no period tabs anymore, the old DAY/WEEK/MONTH switcher is gone along with the mobile
// period-scoped list); the trend and the matrix read the rolling last-30-days window
// (`useAdminOverview`'s `costSeries`, `useAdminCostMatrix('30d')`) — every one of those tiles
// says "elmúlt 30 nap" in its own copy so the two windows are never confused.

const PAGE = 50
const MAX_WINDOW = 500
const HU_MONTHS = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
]
const HU_MONTHS_SHORT = ['jan', 'febr', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec']

/** Report-zone (Europe/Budapest) calendar parts for "today" — decomposed via `Intl` rather than
 *  a naive `Date.getMonth()`, which would read the BROWSER's local zone instead. */
function reportZoneToday(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/** Last day of a 1-based calendar `month` — `new Date(year, month, 0)` is "day 0 of the NEXT
 *  month" (JS Date months are 0-based), which lands on the last day of the month we actually
 *  asked about. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function shortDayLabel(isoDay: string): string {
  const [, m, d] = isoDay.split('-').map(Number)
  return `${HU_MONTHS_SHORT[m - 1]} ${d}.`
}

/** The KPI strip's "vs előző hónap azonos napja" Δ chip copy — honest "nincs előző havi adat"
 *  when the backend never saw a prior-month row (a fresh install, or day 1 of the first tracked
 *  month). Same glyph/wording convention as `costDeltaCopy` (adminViz.ts), but comparing two
 *  point values rather than a trailing series, so it stays a page-local helper. */
function monthDeltaCopy(monthUsd: number | null | undefined, prevUsd: number | null | undefined): { text: string; tone: 'up' | 'down' | 'flat' | 'mut' } {
  if (monthUsd == null || prevUsd == null) return { text: 'nincs előző havi adat', tone: 'mut' }
  if (prevUsd === 0) {
    return monthUsd > 0
      ? { text: '▲ új költés az előző hónaphoz képest', tone: 'up' }
      : { text: '– megegyezik az előző hónappal', tone: 'flat' }
  }
  const pct = ((monthUsd - prevUsd) / prevUsd) * 100
  if (pct > -0.5 && pct < 0.5) return { text: '– megegyezik az előző hónap azonos napjával', tone: 'flat' }
  const direction = pct > 0 ? 'up' : 'down'
  const glyph = direction === 'up' ? '▲' : '▼'
  const word = direction === 'up' ? 'több' : 'kevesebb'
  return { text: `${glyph} ${Math.abs(Math.round(pct))}%-kal ${word} az előző hónap azonos napjához képest`, tone: direction }
}

function featureEntries(groups: { key?: string | null; costUsd?: number | null }[]): AdminVizEntry[] {
  return groups.map((g) => {
    const key = g.key ?? '__unknown__'
    const lbl = g.key ? featureLabel(g.key) : { label: 'ismeretlen' }
    return { key, label: lbl.label, value: g.costUsd ?? 0 }
  })
}

function userEntries(groups: { userId?: string | null; name?: string | null; costUsd?: number | null }[]): AdminVizEntry[] {
  return groups.map((g) => ({
    key: g.userId ?? '__background__',
    label: g.name ?? 'Háttér',
    sub: g.userId === null ? 'rendszer' : undefined,
    value: g.costUsd ?? 0,
  }))
}

export function AdminCostPage() {
  const navigate = useNavigate()
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const [searchParams, setSearchParams] = useSearchParams()
  const [callKind, setCallKind] = useState<string | undefined>(undefined)
  const [limit, setLimit] = useState(PAGE)
  const listRef = useRef<HTMLDivElement>(null)
  const mountedForScroll = useRef(false)

  const day = searchParams.get('day') ?? undefined
  const feature = searchParams.get('feature') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const userId = searchParams.get('user') ?? undefined
  const filters: Filters = { day, feature, status, userId, callKind }

  const summary = useLlmUsageSummary({ enabled: isOwner })
  const breakdown = useLlmUsageBreakdown('MONTH')
  const calls = useLlmCalls('MONTH', filters, limit)
  const ov = useAdminOverview(isOwner)
  const cm30 = useAdminCostMatrix('30d', isOwner)
  const users = useAdminUserInsights(null, 'name', 'asc', isOwner)

  // A new filter starts a fresh window — a grown limit under a narrower filter would make the
  // first render needlessly heavy for no reason (mirrors the pre-rebuild page's own rule).
  const changeFilters = (next: Filters) => {
    setCallKind(next.callKind)
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      const sync = (key: string, value: string | undefined) => { if (value) p.set(key, value); else p.delete(key) }
      sync('day', next.day)
      sync('feature', next.feature)
      sync('status', next.status)
      sync('user', next.userId)
      return p
    })
    setLimit(PAGE)
  }

  const pickDay = (isoDay: string) => changeFilters({ ...filters, day: isoDay })

  // A deep link (Pulzus alert, top-card "more", trend dot) narrows the SAME page in place —
  // bring the call list on screen so the narrowing is visible, not just a chip somewhere above
  // the fold. Skipped on the very first render (an initial `?feature=` deep link already opens
  // scrolled to the top; there is nothing to "scroll to" yet).
  useEffect(() => {
    if (!mountedForScroll.current) { mountedForScroll.current = true; return }
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [day, feature])

  const today = reportZoneToday()
  const monthName = HU_MONTHS[today.month - 1]?.toUpperCase() ?? ''
  const monthCost = summary.data.month.costUsd
  const runRate = monthCost != null ? monthRunRate(monthCost, today.day, daysInMonth(today.year, today.month)) : null
  const delta = monthDeltaCopy(monthCost, summary.data.prevMonthToSameDayUsd)

  const nonOwnerActive = users.data.filter((u) => u.role !== 'OWNER' && u.status === 'ACTIVE').length
  const perAccount = nonOwnerActive > 0 && monthCost != null ? monthCost / nonOwnerActive : null

  const summaryQuery: AdminTileQuery = { isError: summary.isError, isPending: summary.isPending, refetch: summary.refetch }
  const perAccountQuery: AdminTileQuery = {
    isError: summary.isError || users.isError,
    isPending: summary.isPending || users.isPending,
    refetch: () => { summary.refetch(); users.refetch() },
  }
  const breakdownQuery: AdminTileQuery = { isError: breakdown.isError, isPending: breakdown.isPending, refetch: breakdown.refetch }
  const trendQuery: AdminTileQuery = { isError: ov.isError, isPending: ov.isPending, refetch: ov.refetch }
  const matrixQuery: AdminTileQuery = { isError: cm30.isError, isPending: cm30.isPending, refetch: cm30.refetch }
  const callsQuery: AdminTileQuery = { isError: calls.isError, isPending: calls.isPending, refetch: calls.refetch }

  const mireMegyRows: TopRow[] = topNFromEntries(featureEntries(breakdown.data.features), 5, usd).map((row) => ({
    ...row,
    to: row.key === '__unknown__' ? undefined : `/admin/cost?feature=${row.key}`,
  }))
  const kikRows: TopRow[] = topNFromEntries(userEntries(breakdown.data.byUser), 5, usd).map((row) => ({
    ...row,
    to: row.key === '__background__' ? undefined : `/admin/cost?user=${row.key}`,
  }))

  const costSeries = ov.data.costSeries.map((d) => ({ day: d.day, usd: d.amountUsd }))
  const spikes = new Set(spikeDays(costSeries))
  const latestSpike = costSeries.filter((d) => spikes.has(d.day)).at(-1)

  const matrixMax = Math.max(...cm30.data.cells.map((c) => c.costUsd), 1)

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/admin')} label="‹ Admin" />
      <EntranceGroup>
        <PageHero icon="i-erme" name="Költés" sub="AI-hívások havi költése és mintázatai" />

        <PageBody className="col gap-md">
          <MosaicDesktop>
            <AdminTile query={summaryQuery} wash="gold" eyebrow={`${monthName} · NAPTÁRI HÓNAP`} span={3}>
              <Poster spot="s-medal" big={usd(monthCost ?? 0)}
                foot={<span className={`ad-delta ${delta.tone === 'mut' ? 'flat' : delta.tone}`}>{delta.text}</span>} />
              <div className="ad-mut" style={{ fontSize: 9.5, marginTop: 2 }}>~ becslés — árazott hívások összege</div>
            </AdminTile>

            <AdminTile query={summaryQuery} wash="sky" eyebrow="Várható hó végén" span={3}>
              <Poster spot="s-hegycel" big={usd(runRate ?? 0)} foot={<span className="ad-mut">a mostani tempóval</span>} />
            </AdminTile>

            <AdminTile query={perAccountQuery} wash="sage" eyebrow="Egy aktív fiókra jut" span={3}>
              <Poster spot="s-energia" big={perAccount != null ? usd(perAccount) : '—'}
                foot={<span className="ad-mut">{nonOwnerActive > 0 ? 'aktív fiókonként' : 'nincs aktív fiók'}</span>} />
            </AdminTile>

            <AdminTile query={breakdownQuery} wash="coral" eyebrow="Ismeretlen költségű hívások" span={3}>
              <Poster spot="s-hajtas" big={huInt(breakdown.data.totals.unpricedCount)} foot={<span className="ad-mut">árlista nélküli hívás</span>} />
            </AdminTile>

            <AdminTile query={breakdownQuery} wash="gold" eyebrow="Mire megy a pénz" span={6}>
              <TopListTile title="Mire megy a pénz" rows={mireMegyRows} />
            </AdminTile>

            <AdminTile query={breakdownQuery} wash="coral" eyebrow="Ki költi" span={6}>
              <TopListTile title="Ki költi" rows={kikRows} />
            </AdminTile>

            <AdminTile query={breakdownQuery} wash="sky" eyebrow="Modell-bontás" span={12}>
              <AiModelBreakdown groups={breakdown.data.models} />
            </AdminTile>

            <AdminTile query={trendQuery} wash="gold" eyebrow="Napi költés · elmúlt 30 nap" span={12}>
              {latestSpike && (
                <div style={{ marginBottom: 6 }}>
                  <span className="ad-tag warn">kiugrás {shortDayLabel(latestSpike.day)} · {usd(latestSpike.usd)}</span>
                </div>
              )}
              <div style={{ position: 'relative' }}>
                <Sparkline points={costSeries.map((d) => d.usd)} tone="gold" ariaLabel="Napi költés 30 nap" />
                <CostTrendDots days={costSeries} spikes={spikes} onPick={pickDay} />
              </div>
            </AdminTile>

            <AdminTile query={callsQuery} wash="sage" eyebrow="Hívások" span={12}>
              <div ref={listRef} data-testid="call-list">
                <AiCallFilters
                  totals={breakdown.isError ? null : breakdown.data.totals}
                  filters={filters}
                  onChange={changeFilters}
                />

                {calls.data.items.length === 0 ? (
                  <GhostState message="Ebben a szűrésben nincs naplózott hívás." />
                ) : (
                  <div>
                    {calls.data.items.map((call, i) => (
                      <div key={call.id} className="rise" style={{ '--d': `${60 + i * 40}ms` } as React.CSSProperties}>
                        <AiCallRow call={call} />
                      </div>
                    ))}

                    {calls.data.hasMore && limit < MAX_WINDOW && (
                      <div style={{ textAlign: 'center', marginTop: 11 }}>
                        <button
                          type="button"
                          onClick={() => setLimit((n) => Math.min(n + PAGE, MAX_WINDOW))}
                          style={{ minHeight: 44, borderRadius: 999, padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}
                        >
                          További hívások ({PAGE})
                        </button>
                      </div>
                    )}
                    {calls.data.hasMore && limit >= MAX_WINDOW && (
                      <p className="text-tertiary" style={{ textAlign: 'center', fontSize: 10.5, marginTop: 11 }}>
                        Az ablak betelt ({MAX_WINDOW} hívás) — szűkíts szűrővel a régebbiekhez.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <p className="aiu-foot">~ becslés — a modellárak tájékoztató jellegűek · Befagyasztott ártábla hívásonként.</p>
            </AdminTile>

            <AdminTile query={matrixQuery} wash="lav" eyebrow="Teljes mátrix · elmúlt 30 nap" span={12}>
              <CollapsibleStrip
                eyebrow="Megnyitás"
                summary={<span className="ad-mut">felhasználók × funkciók</span>}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '4px 8px' }}></th>
                        {cm30.data.features.map((f) => (
                          <th key={f} style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {featureLabel(f).label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cm30.data.users.map((u) => (
                        <tr key={u.id ?? '__background__'}>
                          <td style={{ padding: '4px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>{u.label}</td>
                          {cm30.data.features.map((f) => {
                            const cell = cm30.data.cells.find((c) => c.userId === u.id && c.feature === f)
                            const value = cell?.costUsd ?? 0
                            const title = cell
                              ? `${u.label} · ${featureLabel(f).label}: ${usd(cell.costUsd)}${cell.unknownCalls > 0 ? ` · ${cell.unknownCalls} árazatlan hívás` : ''}`
                              : `${u.label} · ${featureLabel(f).label}: nincs hívás`
                            return (
                              <td key={f} title={title} style={{ padding: '4px 8px', textAlign: 'center', background: heatColor(value, matrixMax), minWidth: 52 }}>
                                {cell ? usd(value) : '—'}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CollapsibleStrip>
            </AdminTile>
          </MosaicDesktop>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}

function Poster({ spot, big, foot }: { spot: Parameters<typeof ClaySpot>[0]['name']; big: string; foot: ReactNode }) {
  return (
    <div className="ad-poster">
      <div className="ad-spot spot"><ClaySpot name={spot} size={44} /></div>
      <div className="ad-big">{big}</div>
      <div className="foot">{foot}</div>
    </div>
  )
}

/** Absolutely-positioned overlay of clickable day dots over the `Sparkline` below it — same
 *  viewBox/normalisation math as `Sparkline` itself (W/H/PAD), so the dots land exactly on the
 *  line regardless of the tile's actual rendered width (both SVGs share one `viewBox` in
 *  normalised coordinates, `preserveAspectRatio="none"`). Every day is clickable (sets `?day=`);
 *  only spike days get the visible coral marker — a day with no anomaly is still pickable, just
 *  invisible, so a tester can always drill into a specific date from the chart. */
function CostTrendDots({ days, spikes, onPick }: {
  days: { day: string; usd: number }[]
  spikes: Set<string>
  onPick: (day: string) => void
}) {
  if (days.length === 0) return null
  const W = 480, H = 96, PAD = 8
  const values = days.map((d) => d.usd)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const n = days.length
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      role="presentation"
    >
      {days.map((d, i) => {
        const x = n === 1 ? 0 : (i / (n - 1)) * W
        const y = H - PAD - ((d.usd - min) / range) * (H - PAD * 2)
        const isSpike = spikes.has(d.day)
        return (
          <circle
            key={d.day}
            cx={x}
            cy={y}
            r={isSpike ? 5 : 3}
            fill={isSpike ? '#D8481F' : 'transparent'}
            stroke={isSpike ? '#fff' : 'none'}
            strokeWidth={isSpike ? 1.5 : 0}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label={`Nap kiválasztása: ${d.day} · ${usd(d.usd)}`}
            onClick={() => onPick(d.day)}
          />
        )
      })}
    </svg>
  )
}
