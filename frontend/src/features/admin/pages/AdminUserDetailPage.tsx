import { useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMe } from '@/data/hooks'
import { useAdminUserDetail } from '@/data/admin/adminInsightsHooks'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { ClaySpot } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MosaicDesktop, MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { huInt } from '@/shared/lib/huNum'

// User részlet — ported from admin-body.html's #d-detail (the "opened" state of the Huawei
// slide-in, minus the slide: this task registers it as its own react-router page). The hero
// below is hand-rolled (`.ad-hero`), not the shared `PageHero` — see the comment on that block
// for why. The ring gauge (activeDays30d / 30) markup lives here rather than in the shared
// Mozaik kit because it is admin-only (.ad-ring, prototype.css §Admin hub graphics).
//
// Adatok tab: this task renders the inventory list only — the embedded per-table row browser
// (`<AdminDataTable table={...} userId={id} />`) arrives in Task 12, see the marker below.
const usd = (v: number) => `$${v.toFixed(2)}`
const TABS = ['Aktivitás', 'Adatok', 'Feature-ök', 'Költség'] as const
type Tab = (typeof TABS)[number]

export function AdminUserDetailPage() {
  const { id } = useParams()
  const userId = id ?? ''
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const navigate = useNavigate()
  const detail = useAdminUserDetail(userId, isOwner)
  const [tab, setTab] = useState<Tab>('Aktivitás')

  const user = detail.data.user
  // Fix round 1 (Finding 1): `useAdminUserDetail` passes `enabled: isOwner && id !== ''` to
  // useDualQuery/useQuery. In TanStack Query v5 a query with `enabled: false` and no cached
  // data never leaves `status: 'pending'` — it simply never fetches. So when `userId === ''`,
  // `detail.isPending` would stay `true` forever if we tried to infer "no id" from it, and the
  // `!detail.isPending && ... && user.id === ''` form below could never fire for that case —
  // the page would render the full hero indefinitely with blank/zero fields instead of the
  // "not found" message. `userId === ''` is directly observable (it's a local value, not
  // derived from query status), so check it up front; the genuine "query settled, no such
  // user" case still falls out of the second half exactly as before.
  const notFound = userId === '' || (!detail.isPending && !detail.isError && user.id === '')

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
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <EntranceGroup>
              {tab === 'Aktivitás' && (
                <MosaicDesktop>
                  <AdminTile query={detail} wash="coral" eyebrow="Aktivitás · 90 nap" span={12}>
                    <div className="ad-cell" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div className="ad-big">{user.activeDays30d}<u>aktív nap a 30-ból</u></div>
                      <ClaySpot name="s-hajtas" size={48} />
                    </div>
                    <HeatStrip series={detail.data.activitySeries} />
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
                          <tr key={row.table} className="norow">
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
                    {/* Task 12: embedded row browser */}
                  </AdminTile>
                </MosaicDesktop>
              )}

              {tab === 'Feature-ök' && (
                <MosaicDesktop>
                  <AdminTile query={detail} wash="lav" eyebrow="Feature-használat · 30 nap" span={12}>
                    <div className="ad-big">{huInt(Object.values(detail.data.featureUsage30d).reduce((a, b) => a + b, 0))}<u>hívás</u></div>
                    <div style={{ marginTop: 6 }}>
                      {Object.entries(detail.data.featureUsage30d).map(([feature, count]) => (
                        <FeatureRow key={feature} label={feature} value={count} max={maxOf(detail.data.featureUsage30d)} />
                      ))}
                    </div>
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
            </EntranceGroup>
          </>
        )}
      </PageBody>
    </MozaikPage>
  )
}

function footprintShare(n: number, all: { rowCount: number }[]): number {
  const max = Math.max(1, ...all.map((r) => r.rowCount))
  return Math.round((n / max) * 1000) / 10
}

function maxOf(rec: Record<string, number>): number {
  const vals = Object.values(rec)
  return vals.length ? Math.max(...vals) : 1
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

/** 90-day activity heat strip — one column per day, summed across every activity series. */
function HeatStrip({ series }: { series: { key: string; days: { day: string; count: number }[] }[] }) {
  const n = series[0]?.days.length ?? 0
  const totals = Array.from({ length: n }, (_, i) => series.reduce((sum, s) => sum + (s.days[i]?.count ?? 0), 0))
  const max = Math.max(1, ...totals)
  return (
    <>
      <div className="ad-heat">
        {totals.map((v, i) => (
          <i key={i} style={{ background: heatColor(v, max), ['--d' as string]: `${(0.25 + i * 0.006).toFixed(3)}s` } as CSSProperties} />
        ))}
      </div>
      <div className="ad-heatax"><span>90 NAPJA</span><span>60</span><span>30</span><span>MA</span></div>
    </>
  )
}

function heatColor(v: number, max: number): string {
  if (!v) return 'rgba(43,33,24,.07)'
  const t = 0.22 + 0.78 * (v / max)
  return `rgba(216,72,31,${t.toFixed(2)})`
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
