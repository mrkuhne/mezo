import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe } from '@/data/hooks'
import { useAdminUserInsights } from '@/data/admin/adminInsightsHooks'
import type { AdminSortDir, AdminUserInsightResponse, AdminUserInsightSort } from '@/data/admin/adminInsightsApi'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { STATUS_LABEL, STATUS_TONE, TesterCard } from '@/features/admin/components/TesterCard'
import { testerStatus, type TesterStatus } from '@/features/admin/lib/adminViz'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MosaicDesktop, MozaikPage, PageBody, PageHero } from '@/shared/ui/mozaik'
import { huInt, usd } from '@/shared/lib/huNum'

// Emberek — the tester list (mezo-zde2 Task 2), replacing the old dense-table-only page (ported
// verbatim below as the "Táblázat nézet" toggle target, same markup/tests as before — see the
// file's own git history for the pre-rebuild version). Cards are the default view per the plan
// Rulings; the old table survives unchanged behind the toggle chip.
const STATUS_ORDER: TesterStatus[] = ['aktiv', 'csendesedik', 'lemorzsolodott', 'meg_nem_aktiv']

type CardSortKey = 'kockazat' | 'koltseg'
const CARD_SORTS: { key: CardSortKey; label: string }[] = [
  { key: 'kockazat', label: 'kockázat' },
  { key: 'koltseg', label: 'költség' },
]

/** Quiet-first risk ordering (mezo-zde2 Task 2 Rulings' default sort): ascending by
 *  `lastActivityAt`, a never-active user (null) sorts FIRST — the riskiest tester of all, same
 *  "null first" honesty already used by `quietTesters` (adminViz.ts), just not routed through
 *  that function (this sort keeps every row, including the owner; `quietTesters` deliberately
 *  drops the owner and caps the list — a different shape for a different tile). */
function byRiskAsc(a: AdminUserInsightResponse, b: AdminUserInsightResponse): number {
  const aAt = a.lastActivityAt ?? null
  const bAt = b.lastActivityAt ?? null
  if (aAt === null && bAt === null) return 0
  if (aAt === null) return -1
  if (bAt === null) return 1
  return new Date(aAt).getTime() - new Date(bAt).getTime()
}

export function AdminUsersPage() {
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<AdminUserInsightSort>('lastActivityAt')
  const [dir, setDir] = useState<AdminSortDir>('desc')
  // Fix round: final review Finding 5 — `q` used to ride straight into the query key with no
  // debounce, so a keystroke burst fired one GET per character. Debounce the value that reaches
  // the network (~300ms, the repo's established debounce window — see
  // `useFeasibilityPreview`/goalHooks.ts for the same setTimeout+useEffect pattern); the input's
  // own `value`/`onChange` below stay bound to the immediate `q`, so typing never feels laggy.
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])
  const users = useAdminUserInsights(debouncedQ || null, sort, dir, isOwner)
  // Client-side safety net on top of the server-side `q` filter: the mock queryFn always
  // serves the static seed regardless of the query key, and a real backend's own filtering
  // is out of this component's control either way — filtering the already-fetched rows here
  // keeps "typing filters the table" true in both modes without depending on either.
  const needle = q.trim().toLowerCase()
  const filteredUsers = needle === ''
    ? users.data
    : users.data.filter((u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))

  const toggleSort = (key: AdminUserInsightSort) => {
    if (key === sort) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(key)
      setDir('desc')
    }
  }

  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [statusFilter, setStatusFilter] = useState<TesterStatus | null>(null)
  const [cardSort, setCardSort] = useState<CardSortKey>('kockazat')

  // One shared `testerStatus` bucketing (adminViz.ts) — status is derived once here per row and
  // reused by both the summary-strip counts and the filter, so a count can never drift from
  // what clicking that cell actually shows.
  const withStatus = useMemo(
    () => filteredUsers.map((u) => ({ u, status: testerStatus(u.lastActivityAt ?? null) })),
    [filteredUsers],
  )

  // Summary counts (Rulings): the owner is deliberately excluded from the two CHURN buckets
  // (csendesedik/lemorzsolódott) — an owner going quiet is a fact about the founder's own usage,
  // not a churn signal about the tester base this strip exists to watch — but IS counted
  // normally in aktív/még nem aktív, and the owner's card always renders regardless of the
  // active filter (see `visibleRows` below).
  const counts: Record<TesterStatus, number> = {
    aktiv: 0, csendesedik: 0, lemorzsolodott: 0, meg_nem_aktiv: 0,
  }
  withStatus.forEach(({ u, status }) => {
    if (u.role === 'OWNER' && (status === 'csendesedik' || status === 'lemorzsolodott')) return
    counts[status] += 1
  })

  const visibleRows = statusFilter === null
    ? withStatus
    : withStatus.filter(({ u, status }) => u.role === 'OWNER' || status === statusFilter)

  const sortedRows = [...visibleRows].sort((a, b) => (
    cardSort === 'koltseg' ? b.u.cost30dUsd - a.u.cost30dUsd : byRiskAsc(a.u, b.u)
  ))

  return (
    <MozaikPage tone="coral">
      <PageHero name="Emberek" sub={`${users.data.length} fiók`} />
      <PageBody>
        <EntranceGroup>
          {view === 'cards' && (
            <MosaicDesktop>
              {STATUS_ORDER.map((s) => (
                <AdminTile key={s} query={users} wash="coral" eyebrow={STATUS_LABEL[s]} span={3}>
                  <button
                    type="button"
                    className={`ad-poster-btn${statusFilter === s ? ' on' : ''}`}
                    aria-pressed={statusFilter === s}
                    aria-label={STATUS_LABEL[s]}
                    onClick={() => setStatusFilter((f) => (f === s ? null : s))}
                  >
                    <div className="ad-poster">
                      <div className={`ad-big ad-count-${STATUS_TONE[s]}`}>{huInt(counts[s])}</div>
                    </div>
                  </button>
                </AdminTile>
              ))}
            </MosaicDesktop>
          )}

          <div className="ad-chiprow" style={{ marginTop: 10 }}>
            {view === 'cards' && CARD_SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`ad-chip${cardSort === s.key ? ' on' : ''}`}
                aria-pressed={cardSort === s.key}
                onClick={() => setCardSort(s.key)}
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              className={`ad-chip${view === 'table' ? ' on' : ''}`}
              aria-pressed={view === 'table'}
              onClick={() => setView((v) => (v === 'table' ? 'cards' : 'table'))}
            >
              Táblázat nézet
            </button>
          </div>

          {view === 'cards' ? (
            <MosaicDesktop>
              <AdminTile query={users} wash="coral" eyebrow="Tesztelők" span={12}>
                <div className="ad-cell" style={{ marginBottom: 10 }}>
                  <input
                    type="search"
                    placeholder="Keresés név vagy email szerint…"
                    aria-label="Keresés"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="ad-chip"
                    style={{ minWidth: 240, cursor: 'text' }}
                  />
                </div>
                {sortedRows.length === 0 ? (
                  <p className="ad-mut">Nincs találat.</p>
                ) : (
                  <div className="ad-testergrid">
                    {sortedRows.map(({ u }, i) => (
                      <TesterCard key={u.id} user={u} delayMs={i * 25} />
                    ))}
                  </div>
                )}
              </AdminTile>
            </MosaicDesktop>
          ) : (
            <MosaicDesktop>
              <AdminTile query={users} wash="coral" eyebrow="Fiókok" span={12}>
                <div className="ad-cell" style={{ marginBottom: 10 }}>
                  <input
                    type="search"
                    placeholder="Keresés név vagy email szerint…"
                    aria-label="Keresés"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="ad-chip"
                    style={{ minWidth: 240, cursor: 'text' }}
                  />
                </div>
                <div className="ad-scroll">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Szerep</th>
                        <SortableHeader label="Sorok" sortKey="rowCount" sort={sort} dir={dir} onSort={toggleSort} className="num" />
                        <th>Vektor</th>
                        <SortableHeader label="Költség · 30 nap" sortKey="cost30dUsd" sort={sort} dir={dir} onSort={toggleSort} className="num" />
                        <SortableHeader label="Aktív nap" sortKey="activeDays30d" sort={sort} dir={dir} onSort={toggleSort} className="num" />
                        <SortableHeader label="Utolsó aktivitás" sortKey="lastActivityAt" sort={sort} dir={dir} onSort={toggleSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 && (
                        <tr className="norow"><td colSpan={7} className="ad-mut">Nincs találat.</td></tr>
                      )}
                      {filteredUsers.map((u) => (
                        <tr key={u.id} onClick={() => navigate(`/admin/users/${u.id}`)}>
                          <td>
                            <div className="ad-cell">
                              <span className="ad-avatar" style={{ background: '#A84A26' }}>{u.name.charAt(0).toUpperCase()}</span>
                              <div>
                                <div style={{ fontWeight: 600 }}>{u.name}</div>
                                <div className="ad-mut" style={{ fontSize: 10 }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {u.role === 'OWNER'
                              ? <span className="ad-tag ok">owner</span>
                              : u.status === 'DISABLED' ? <span className="ad-tag mut">letiltva</span> : <span className="ad-tag mut">user</span>}
                          </td>
                          <td className="num">{huInt(u.rowCount)}</td>
                          <td className="num">{huInt(u.vectorCount)}</td>
                          <td className={`num${u.cost30dUsd === 0 ? ' ad-mut' : ''}`}>{usd(u.cost30dUsd)}</td>
                          <td className="num">{u.activeDays30d} / 30</td>
                          <td className={u.lastActivityAt ? '' : 'ad-mut'}>{u.lastActivityAt ?? 'soha'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AdminTile>
            </MosaicDesktop>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

function SortableHeader({ label, sortKey, sort, dir, onSort, className }: {
  label: string
  sortKey: AdminUserInsightSort
  sort: AdminUserInsightSort
  dir: AdminSortDir
  onSort: (key: AdminUserInsightSort) => void
  className?: string
}) {
  const active = sort === sortKey
  return (
    <th className={className} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="ad-sortbtn" onClick={() => onSort(sortKey)}>
        {label}{active && <span aria-hidden="true">{dir === 'asc' ? ' ↑' : ' ↓'}</span>}
      </button>
    </th>
  )
}
