import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useMe } from '@/data/hooks'
import { useAdminFeatureBoard, useAdminFeatureDetail } from '@/data/admin/adminInsightsHooks'
import type { AdminFeaturePeriod } from '@/data/admin/adminInsightsApi'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { KIND_LABEL, KIND_TAG_TONE } from '@/features/admin/components/FeatureScoreRow'
import { Sparkline } from '@/features/admin/components/Sparkline'
import { TopListTile, type TopRow } from '@/features/admin/components/TopListTile'
import { featureLabel, feedbackReasonLabel } from '@/features/admin/lib/labels'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MosaicDesktop, MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { hu1, huInt, usd } from '@/shared/lib/huNum'

// Feature detail page (mezo-kxnn Task 3) — `/admin/features/:key`, the scorecard row's drill-
// through target. Single query (`useAdminFeatureDetail`) drives every tile below the head, so a
// backend failure degrades ALL of them together (same `AdminTile` per-tile recipe as everywhere
// else, just with one shared query object rather than several independent ones — there is only
// one endpoint here). An unknown `:key` answers 404 (`useAdminFeatureDetail`'s own comment); that
// is folded into the honest `data.key === ''` empty shape rather than surfacing as a distinct
// error, so `notFound` is a plain read, matching the `AdminUserDetailPage`/`usePatternPairDetail`
// precedent.

const MISSING_MARK = ' (nincs címke)'

const PERIODS: { key: AdminFeaturePeriod; label: string }[] = [
  { key: '30d', label: '30 nap' },
  { key: '90d', label: '90 nap' },
]

export function AdminFeatureDetailPage() {
  const { key: rawKey } = useParams()
  const key = rawKey ?? ''
  const navigate = useNavigate()
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const [period, setPeriod] = useState<AdminFeaturePeriod>('30d')
  const detail = useAdminFeatureDetail(key, period, isOwner)
  // `acceptedShare` (mezo-kxnn final review Finding 3) lives on the BOARD row, not the detail
  // response's own contract — `AdminFeatureDetailResponse` carries no such field. Always null
  // until `ai_draft_outcome` ships (slice 8; see the schema's own doc comment on
  // `AdminFeatureRow.acceptedShare`), so this degrades to the honest "még nem mérjük" line even
  // while the board query is loading/empty — never a fabricated 0%.
  const board = useAdminFeatureBoard(period, isOwner)
  const acceptedShare = board.data.rows.find((r) => r.key === key)?.acceptedShare ?? null

  const label = featureLabel(key)
  const notFound = !detail.isPending && !detail.isError && detail.data.key === ''

  const d = detail.data
  const totalCostUsd = d.costByModel.reduce((sum, m) => sum + m.costUsd, 0)
  const feedbackTotals = d.feedbackTrend === null
    ? null
    : d.feedbackTrend.reduce((acc, p) => ({ up: acc.up + p.up, down: acc.down + p.down }), { up: 0, down: 0 })

  const topUserRows: TopRow[] = d.topUsers.map((u) => ({
    key: u.name,
    label: u.name,
    value: `${usd(u.costUsd)} · ${huInt(u.uses)} haszn.`,
  }))

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/admin/features')} label="Vissza a funkciókhoz" />
      <PageBody>
        {notFound ? (
          <p className="ad-mut">Ismeretlen funkció.</p>
        ) : (
          <>
            <div className="ad-feature-head">
              <div className="nm">
                <span className="mz-hero-nm">{label.label}{label.missing && MISSING_MARK}</span>
                {!detail.isPending && !detail.isError && (
                  <span className={`ad-tag ${KIND_TAG_TONE[d.kind]}`}>{KIND_LABEL[d.kind]}</span>
                )}
              </div>
              <div className="ad-chiprow" role="group" aria-label="Időszak">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={`ad-chip${period === p.key ? ' on' : ''}`}
                    aria-pressed={period === p.key}
                    onClick={() => setPeriod(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <EntranceGroup>
              <MosaicDesktop>
                <AdminTile query={detail} wash="lav" eyebrow="Egyedi felhasználók" span={3}>
                  <div className="ad-poster"><div className="ad-big">{huInt(d.funnel.tried)}</div></div>
                </AdminTile>
                <AdminTile query={detail} wash="gold" eyebrow="Költség" span={3}>
                  <div className="ad-poster"><div className="ad-big">{usd(totalCostUsd)}</div></div>
                </AdminTile>
                <AdminTile query={detail} wash="sage" eyebrow="Visszajelzés" span={3}>
                  {feedbackTotals === null ? (
                    <span className="ad-mut">nincs visszajelzés-forrás</span>
                  ) : (
                    <span className="ad-updown">
                      <span className="up">▲ {huInt(feedbackTotals.up)}</span>
                      <span className="down">▼ {huInt(feedbackTotals.down)}</span>
                    </span>
                  )}
                  <p className="ad-mut ad-accepted-share">
                    Elfogadási arány: {acceptedShare === null ? 'még nem mérjük' : `${hu1(acceptedShare * 100)}%`}
                  </p>
                </AdminTile>
                <AdminTile query={detail} wash="coral" eyebrow="p90 válaszidő" span={3}>
                  <div className="ad-poster">
                    <div className="ad-big">
                      {d.reliability.p90LatencyMs === null ? '–' : `${huInt(d.reliability.p90LatencyMs)} ms`}
                    </div>
                  </div>
                </AdminTile>

                <AdminTile query={detail} wash="lav" eyebrow="Használat · 12 hét" span={6}>
                  {/* Fix round 1: the tile sits next to the Tölcsér tile in the same 12-col
                      grid row, which is naturally taller (3 funnel bars + name chips) — the
                      CSS grid stretches both sp6 tiles to match, and a compact ~96px sparkline
                      pinned to the top of a flex column left a big empty gap below it. `flex: 1`
                      + vertical centering fills that leftover space instead of leaving it bare. */}
                  <div className="ad-trend-wrap">
                    <Sparkline points={d.usageByWeek} tone="lav" ariaLabel={`${label.label} · 12 hét`} />
                  </div>
                </AdminTile>

                <AdminTile query={detail} wash="sky" eyebrow="Tölcsér" span={6}>
                  <FunnelBar label="Kipróbálta" value={d.funnel.tried} max={d.funnel.tried} />
                  <FunnelBar label="Visszatért" value={d.funnel.repeated} max={d.funnel.tried} />
                  <FunnelBar label="Rendszeres" value={d.funnel.habitual} max={d.funnel.tried} />
                  {d.funnel.triedUsers.length > 0 && (
                    <div className="ad-chiprow" style={{ marginTop: 8 }}>
                      {d.funnel.triedUsers.map((name) => (
                        <span key={name} className="ad-tag mut">{name}</span>
                      ))}
                    </div>
                  )}
                </AdminTile>

                <AdminTile query={detail} wash="rose" eyebrow="Visszajelzés-trend" span={6}>
                  {d.feedbackTrend === null ? (
                    <p className="ad-mut">ki van kapcsolva</p>
                  ) : (
                    <>
                      <Sparkline
                        points={d.feedbackTrend.map((p) => p.up)}
                        tone="sage"
                        ariaLabel="jó visszajelzések · 12 hét"
                      />
                      <Sparkline
                        points={d.feedbackTrend.map((p) => p.down)}
                        tone="coral"
                        ariaLabel="rossz visszajelzések · 12 hét"
                      />
                      {d.downReasons !== null && d.downReasons.length > 0 ? (
                        <ul className="ad-reasonlist">
                          {d.downReasons.map((r) => {
                            const rl = feedbackReasonLabel(r.reason)
                            return (
                              <li key={r.reason}>
                                <span>{rl.label}{rl.missing && MISSING_MARK}</span>
                                <span className="num">{huInt(r.count)}</span>
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="ad-mut">Nincs negatív visszajelzés.</p>
                      )}
                    </>
                  )}
                </AdminTile>

                <AdminTile query={detail} wash="coral" eyebrow="Megbízhatóság" span={6}>
                  <div className="ad-cell" style={{ justifyContent: 'space-between' }}>
                    <span>Hibaarány</span>
                    <span>{d.reliability.errorPct === null ? '–' : `${hu1(d.reliability.errorPct)}%`}</span>
                  </div>
                  <div className="ad-cell" style={{ justifyContent: 'space-between' }}>
                    <span>p50 / p90</span>
                    <span>
                      {d.reliability.p50LatencyMs === null ? '–' : `${huInt(d.reliability.p50LatencyMs)} ms`}
                      {' / '}
                      {d.reliability.p90LatencyMs === null ? '–' : `${huInt(d.reliability.p90LatencyMs)} ms`}
                    </span>
                  </div>
                  {d.reliability.topErrors.length > 0 && (
                    <ul className="ad-errorlist">
                      {d.reliability.topErrors.map((e) => (
                        <li key={e.code}><code>{e.code}</code><span className="num">{huInt(e.count)}</span></li>
                      ))}
                    </ul>
                  )}
                </AdminTile>

                <AdminTile query={detail} wash="gold" eyebrow="Költség modellenként · felhasználónként" span={12}>
                  <table className="ad-table">
                    <thead>
                      <tr><th>Modell</th><th className="num">Hívás</th><th className="num">Költség</th></tr>
                    </thead>
                    <tbody>
                      {d.costByModel.map((m) => (
                        <tr key={m.model}>
                          <td><code>{m.model}</code></td>
                          <td className="num">{huInt(m.calls)}</td>
                          <td className="num">{usd(m.costUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 12 }}>
                    <TopListTile title="Legtöbbet költő felhasználók" rows={topUserRows} emptyLabel="Nincs adat." />
                  </div>
                </AdminTile>
              </MosaicDesktop>
            </EntranceGroup>
          </>
        )}
      </PageBody>
    </MozaikPage>
  )
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="ad-funnelrow">
      <span className="lb">{label}</span>
      <div className="ad-bar" style={{ flex: 1 }}>
        <i style={{ width: `${pct}%`, background: '#4E8FB8' }} />
      </div>
      <span className="vv">{huInt(value)}</span>
    </div>
  )
}
