import { useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMe } from '@/data/hooks'
import { useAdminUserDetail, useAdminUserFeedback, useAdminFeatureBoard } from '@/data/admin/adminInsightsHooks'
import { useAdminRows } from '@/data/admin/adminDataHooks'
import type { AdminRowSortDir } from '@/data/admin/adminDataApi'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { DataTable } from '@/features/admin/components/DataTable'
import { ClaySpot } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MosaicDesktop, MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { huInt, usd } from '@/shared/lib/huNum'
import { firstLastActivity, footprintShare, heatColor, maxOf } from '@/features/admin/lib/adminViz'
import { featureLabel, feedbackReasonLabel, surfaceLabel } from '@/features/admin/lib/labels'

const MISSING_MARK = ' (nincs címke)'

// User részlet — ported from admin-body.html's #d-detail (the "opened" state of the Huawei
// slide-in, minus the slide: this task registers it as its own react-router page). The hero
// below is hand-rolled (`.ad-hero`), not the shared `PageHero` — see the comment on that block
// for why. The ring gauge (activeDays30d / 30) markup lives here rather than in the shared
// Mozaik kit because it is admin-only (.ad-ring, prototype.css §Admin hub graphics).
//
// Adatok tab: the inventory list stays here; clicking a row selects that table and mounts a
// `DataTable` below it, bound to `useAdminRows({ table, userId: id, ... })` (mezo-d5iy.12).
//
// Funkciók tab (renamed from Feature-ök, mezo-zde2 Task 3): the adoption list is the existing
// `detail.featureUsage30d`; the "Ezeket még nem találta meg" section is a SECOND, independent
// query (`useAdminFeatureBoard('30d', ...)`) — its own AdminTile, not folded into the adoption
// tile's `query={detail}`, so a board-endpoint failure degrades only that one section.
//
// Visszajelzések tab (new, mezo-zde2 Task 3): per-user companion feedback via
// `useAdminUserFeedback`, inserted right before Memória.
const TABS = ['Aktivitás', 'Adatok', 'Funkciók', 'Költség', 'Visszajelzések', 'Memória'] as const
type Tab = (typeof TABS)[number]

export function AdminUserDetailPage() {
  const { id } = useParams()
  const userId = id ?? ''
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const navigate = useNavigate()
  const detail = useAdminUserDetail(userId, isOwner)
  const board = useAdminFeatureBoard('30d', isOwner)
  const feedback = useAdminUserFeedback(userId, isOwner)
  const [tab, setTab] = useState<Tab>('Aktivitás')

  // Embedded per-table row browser (Adatok tab). Local component state, not URL search params —
  // this is a sub-panel of a user's detail page, not its own navigable surface (that's
  // AdminDataPage). No table selected is the initial state, checked directly against the
  // string — simplest and correct either way; `useAdminRows`'s `isPending` is also safe to
  // branch on now (final review Finding 3 fixed it to report `false` while disabled).
  const [dataTable, setDataTable] = useState('')
  const [dataPage, setDataPage] = useState(0)
  const [dataSort, setDataSort] = useState<string | null>(null)
  const [dataDir, setDataDir] = useState<AdminRowSortDir>('desc')
  const [dataIncludeDeleted, setDataIncludeDeleted] = useState(false)
  const embeddedRows = useAdminRows(
    { table: dataTable, userId, page: dataPage, sort: dataSort, dir: dataDir, includeDeleted: dataIncludeDeleted },
    isOwner && dataTable !== '',
  )
  const selectDataTable = (t: string) => {
    setDataTable(t)
    setDataPage(0)
    setDataSort(null)
    setDataDir('desc')
  }
  const toggleDataSort = (col: string) => {
    if (col === dataSort) setDataDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setDataSort(col); setDataDir('desc') }
    setDataPage(0)
  }
  const dataCanPrev = dataPage > 0
  const dataCanNext = (dataPage + 1) * (embeddedRows.data.size || 1) < embeddedRows.data.total

  const user = detail.data.user
  // Fix round: final review Finding 3 fixed `useAdminUserDetail` itself — it now folds its
  // `enabled` condition into `isPending`, so a disabled query (no id, or a non-owner) reports
  // `isPending: false` immediately instead of hanging forever. That means `detail.isPending`
  // is safe to branch on directly here again: when `userId === ''` the query never fetches,
  // `isPending` is `false`, and `detail.data` is `ADMIN_USER_DETAIL_EMPTY` (`user.id === ''`),
  // so `notFound` still comes out `true` for that case — no separate `userId === ''` check
  // needed (that was the local compensation this fix removes; see the hook's own comment).
  const notFound = !detail.isPending && !detail.isError && user.id === ''

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={() => navigate('/admin/users')} />
      <PageBody>
        {notFound ? (
          <p className="ad-mut">Ez a user nem található.</p>
        ) : (
          <>
            {/* Fix round 1 (Finding 2): deliberately NOT `PageHero` — `PageHero` is shaped for
                the mobile app shell's centred tile→full-page stack, and `/admin` is a desktop
                surface with no `PhoneFrame`/`TabBar`/mobile shell to match. This row-layout hero
                (avatar, name, stats, ring) is admin-only and owns its own markup; don't "unify"
                it with `PageHero` — that would be un-doing a deliberate fork, not a cleanup. */}
            <div className="ad-hero">
              <span className="ad-avatar lg" style={{ background: '#A84A26' }}>{(user.name || '?').charAt(0).toUpperCase()}</span>
              <div>
                <div className="nm">{user.name || '—'}</div>
                <div className="em">{user.email}{user.role === 'OWNER' ? ' · owner' : ' · user'}</div>
              </div>
              <div className="stats">
                <div><span className="v">{huInt(user.rowCount)}</span><span className="ad-eyebrow">sor</span></div>
                <div><span className="v">{huInt(user.vectorCount)}</span><span className="ad-eyebrow">vektor</span></div>
                <div><span className="v">{usd(user.cost30dUsd)}</span><span className="ad-eyebrow">30 nap</span></div>
              </div>
              <Ring pct={Math.round((user.activeDays30d / 30) * 100)} color="#A84A26" size={88} />
            </div>

            <div className="ad-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  className={`ad-tab${tab === t ? ' on' : ''}`}
                  onClick={() => (t === 'Memória' ? navigate(`/admin/users/${userId}/memory`) : setTab(t))}
                >
                  {t}
                </button>
              ))}
            </div>

            <EntranceGroup>
              {tab === 'Aktivitás' && (
                <MosaicDesktop>
                  <AdminTile query={detail} wash="coral" eyebrow="Aktivitás · 90 nap, domainenként" span={12}>
                    <div className="ad-cell" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div className="ad-big">{user.activeDays30d}<u>aktív nap a 30-ból</u></div>
                      <ClaySpot name="s-hajtas" size={48} />
                    </div>
                    {(() => {
                      const { firstDaysAgo, lastDaysAgo } = firstLastActivity(detail.data.activitySeries)
                      return (
                        <p className={firstDaysAgo === null ? 'ad-mut' : undefined} style={{ margin: '2px 0 12px' }}>
                          {firstDaysAgo === null
                            ? 'még nem aktív'
                            : `első aktivitás: ${firstDaysAgo} napja · utolsó aktivitás: ${lastDaysAgo} napja`}
                        </p>
                      )
                    })()}
                    {detail.data.activitySeries.map((s) => {
                      const lbl = featureLabel(s.key)
                      return (
                        <div key={s.key} className="ad-heatrow">
                          <div className="hd"><span className="lb">{lbl.label}{lbl.missing && MISSING_MARK}</span></div>
                          <HeatStrip days={s.days} />
                        </div>
                      )
                    })}
                  </AdminTile>
                </MosaicDesktop>
              )}

              {tab === 'Adatok' && (
                <MosaicDesktop>
                  <AdminTile query={detail} wash="sage" eyebrow="Adat-leltár · táblánként" span={12}>
                    <table className="ad-table">
                      <thead>
                        <tr><th>Tábla</th><th className="num">Sorok</th><th className="num">Törölt</th><th style={{ width: 200 }}>Arány</th></tr>
                      </thead>
                      <tbody>
                        {detail.data.inventory.map((row) => (
                          <tr
                            key={row.table}
                            className={dataTable === row.table ? 'on' : undefined}
                            onClick={() => selectDataTable(row.table)}
                          >
                            <td><code>{row.table}</code></td>
                            <td className="num">{huInt(row.rowCount)}</td>
                            <td className={`num${row.deletedCount ? '' : ' ad-mut'}`}>{row.deletedCount}</td>
                            <td>
                              <div className="ad-bar" style={{ width: 190 }}>
                                <i style={{ background: '#7FA06C', width: `${footprintShare(row.rowCount, detail.data.inventory)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {dataTable !== '' && (
                      <div style={{ marginTop: 14 }}>
                        <div className="ad-cell" style={{ justifyContent: 'space-between' }}>
                          <span className="ad-eyebrow">{dataTable} · {huInt(embeddedRows.data.total)} sor</span>
                          <label className="ad-chip">
                            <input
                              type="checkbox"
                              checked={dataIncludeDeleted}
                              onChange={() => { setDataIncludeDeleted((v) => !v); setDataPage(0) }}
                              style={{ marginRight: 6 }}
                            />
                            Törölt sorok
                          </label>
                        </div>
                        <div className="ad-scroll" style={{ marginTop: 9 }}>
                          <DataTable
                            page={embeddedRows.data}
                            sort={dataSort}
                            dir={dataDir}
                            onSort={toggleDataSort}
                            onNavigateToRow={(refTable, rowId) =>
                              navigate(`/admin/data?table=${encodeURIComponent(refTable)}&rowId=${encodeURIComponent(String(rowId))}`)}
                          />
                        </div>
                        <div className="ad-cell" style={{ marginTop: 9, justifyContent: 'space-between' }}>
                          <button type="button" className="ad-chip" disabled={!dataCanPrev} onClick={() => setDataPage((p) => Math.max(0, p - 1))}>‹ Előző</button>
                          <span className="ad-mut">{dataPage + 1}. oldal · {embeddedRows.data.size}/oldal</span>
                          <button type="button" className="ad-chip" disabled={!dataCanNext} onClick={() => setDataPage((p) => p + 1)}>Következő ›</button>
                        </div>
                      </div>
                    )}
                  </AdminTile>
                </MosaicDesktop>
              )}

              {tab === 'Funkciók' && (
                <MosaicDesktop>
                  <AdminTile query={detail} wash="lav" eyebrow="Feature-használat · 30 nap" span={12}>
                    <div className="ad-big">{huInt(Object.values(detail.data.featureUsage30d).reduce((a, b) => a + b, 0))}<u>hívás</u></div>
                    <div style={{ marginTop: 6 }}>
                      {Object.entries(detail.data.featureUsage30d)
                        .sort(([, a], [, b]) => b - a)
                        .map(([feature, count]) => {
                          const lbl = featureLabel(feature)
                          return (
                            <FeatureRow
                              key={feature}
                              label={`${lbl.label}${lbl.missing ? MISSING_MARK : ''}`}
                              value={count}
                              max={maxOf(detail.data.featureUsage30d)}
                            />
                          )
                        })}
                    </div>
                  </AdminTile>

                  {/* Own AdminTile (own query) so a board-endpoint failure never takes down the
                      adoption list above it — the plan's "AdminTile isolation where new queries
                      mount" rule. Board keys per Rulings: non-system (kind ai/domain/both) rows
                      the user's own featureUsage30d never used. Per-user first-use/habit flags
                      are deliberately deferred (plan Rulings, bd note) — no fake data here. */}
                  <AdminTile query={board} wash="sage" eyebrow="Ezeket még nem találta meg" span={12}>
                    {(() => {
                      const used = new Set(Object.keys(detail.data.featureUsage30d))
                      const undiscovered = board.data.rows.filter((r) => r.kind !== 'system' && !used.has(r.key))
                      if (undiscovered.length === 0) {
                        return <p className="ad-mut">Minden elérhető funkciót kipróbált.</p>
                      }
                      return (
                        <div className="ad-chiprow">
                          {undiscovered.map((r) => {
                            const lbl = featureLabel(r.key)
                            return (
                              <span key={r.key} className="ad-tag mut">{lbl.label}{lbl.missing && MISSING_MARK}</span>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </AdminTile>
                </MosaicDesktop>
              )}

              {tab === 'Költség' && (
                <MosaicDesktop>
                  <AdminTile query={detail} wash="gold" eyebrow="LLM költség · feature szerint, 30 nap" span={12}>
                    <div className="ad-big">{usd(detail.data.costByFeature30d.reduce((a, c) => a + c.costUsd, 0))}</div>
                    <table className="ad-table">
                      <thead>
                        <tr><th>Feature</th><th className="num">Hívás</th><th className="num">Költség</th><th>Árazatlan</th></tr>
                      </thead>
                      <tbody>
                        {detail.data.costByFeature30d.map((c) => (
                          <tr key={c.feature} className="norow">
                            <td>{c.feature}</td>
                            <td className="num">{huInt(c.calls)}</td>
                            <td className={`num${c.costUsd ? '' : ' ad-mut'}`}>{usd(c.costUsd)}</td>
                            <td>{c.unknownCalls ? <span className="ad-tag warn">? {c.unknownCalls} hívás</span> : <span className="ad-mut">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AdminTile>
                </MosaicDesktop>
              )}

              {tab === 'Visszajelzések' && (
                <MosaicDesktop>
                  <AdminTile query={feedback} wash="rose" eyebrow="Visszajelzések" span={12}>
                    {feedback.data.surfaces === null ? (
                      <p className="ad-mut">ki van kapcsolva</p>
                    ) : (
                      <>
                        {feedback.data.surfaces.length === 0 ? (
                          <p className="ad-mut">Még nem adott visszajelzést.</p>
                        ) : (
                          feedback.data.surfaces.map((s) => {
                            const lbl = surfaceLabel(s.kind)
                            return (
                              <div key={s.kind} className="ad-surfacerow">
                                <div className="hd">
                                  <span className="lb">{lbl.label}{lbl.missing && MISSING_MARK}</span>
                                  <span className="cnt">
                                    <span className="up">▲{huInt(s.up)}</span>{' '}
                                    <span className="down">▼{huInt(s.down)}</span>
                                  </span>
                                </div>
                                {s.reasons.length > 0 && (
                                  <ul className="ad-reasonlist">
                                    {s.reasons.map((r) => {
                                      const rl = feedbackReasonLabel(r.reason)
                                      return (
                                        <li key={r.reason}>
                                          <span>{rl.label}{rl.missing && MISSING_MARK}</span>
                                          <span className="num">{huInt(r.count)}</span>
                                        </li>
                                      )
                                    })}
                                  </ul>
                                )}
                              </div>
                            )
                          })
                        )}

                        <div style={{ marginTop: 14 }}>
                          {feedback.data.recall !== null && feedback.data.recall.useful + feedback.data.recall.irrelevant > 0 ? (
                            <>
                              <p>
                                A felidézett emlékek {Math.round(
                                  (100 * feedback.data.recall.useful) /
                                    (feedback.data.recall.useful + feedback.data.recall.irrelevant),
                                )}%-a volt hasznos.
                              </p>
                              <p className="ad-mut">elnémítva: {huInt(feedback.data.recall.suppress)}</p>
                            </>
                          ) : (
                            <p className="ad-mut">Még nincs elég emlék-felidézési visszajelzés.</p>
                          )}
                        </div>
                      </>
                    )}
                  </AdminTile>
                </MosaicDesktop>
              )}
            </EntranceGroup>
          </>
        )}
      </PageBody>
    </MozaikPage>
  )
}

function FeatureRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="ad-domrow">
      <span className="lb" style={{ width: 120 }}>{label}</span>
      <span className="tr"><i style={{ background: '#A84A26', width: `${Math.round((value / (max || 1)) * 100)}%` }} /></span>
      <span className="vv" style={{ width: 44 }}>{huInt(value)}</span>
    </div>
  )
}

/** A single domain's 90-day activity heat strip — one column per day (mezo-zde2 Task 3: was a
 *  cross-domain sum, now called once per domain so each gets its own row; the per-cell entrance
 *  stagger is unchanged). */
function HeatStrip({ days }: { days: { day: string; count: number }[] }) {
  const counts = days.map((d) => d.count)
  const max = Math.max(1, ...counts)
  return (
    <>
      <div className="ad-heat">
        {counts.map((v, i) => (
          <i key={i} style={{ background: heatColor(v, max), ['--d' as string]: `${(0.25 + i * 0.006).toFixed(3)}s` } as CSSProperties} />
        ))}
      </div>
      <div className="ad-heatax"><span>90 NAPJA</span><span>60</span><span>30</span><span>MA</span></div>
    </>
  )
}

/** The user-detail hero's ring gauge — admin-only, `.ad-ring` (prototype.css §Admin hub
 *  graphics). Rests fully drawn (stroke-dashoffset = the target offset); `.mz-play` only
 *  supplies the sweep-in `from` keyframe (see the CSS's entrance-choreography note). */
function Ring({ pct, color, size }: { pct: number; color: string; size: number }) {
  const r = size / 2 - 9
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100)
  return (
    <div className="ad-ring" style={{ '--c': c.toFixed(1), '--off': off.toFixed(1) } as CSSProperties}>
      <svg width={size} height={size}>
        <circle className="trk" cx={size / 2} cy={size / 2} r={r} strokeWidth={9} />
        <circle className="arc" cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={9} />
      </svg>
      <div className="mid"><div><b>{pct}%</b><small>aktív nap</small></div></div>
    </div>
  )
}
