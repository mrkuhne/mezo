import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe } from '@/data/hooks'
import { useAdminUserInsights } from '@/data/admin/adminInsightsHooks'
import type { AdminSortDir, AdminUserInsightSort } from '@/data/admin/adminInsightsApi'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MosaicDesktop, MozaikPage, PageBody, PageHero } from '@/shared/ui/mozaik'
import { huInt } from '@/shared/lib/huNum'

// Userek — the account list (mezo-d5iy.11), ported from admin-body.html's #d-users: one sp12
// tile, a dense table, sortable column headers, rows that navigate to /admin/users/:id (a real
// route push, not the prototype's Huawei-slide-in panel — the admin surface here uses ordinary
// react-router pages per task 11's route registration, not an in-page overlay).
const usd = (v: number) => `$${v.toFixed(2)}`

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

  return (
    <MozaikPage tone="coral">
      <PageHero name="Userek" sub={`${users.data.length} fiók`} />
      <PageBody>
        <EntranceGroup>
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
