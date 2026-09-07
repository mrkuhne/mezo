import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMe } from '@/data/hooks'
import { useAdminRows, useAdminTables, useAdminViews } from '@/data/admin/adminDataHooks'
import type { AdminRowSortDir, AdminViewDescriptor } from '@/data/admin/adminDataApi'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { DataTable } from '@/features/admin/components/DataTable'
import { TablePicker } from '@/features/admin/components/TablePicker'
import { UserPicker } from '@/features/admin/components/UserPicker'
import { cn } from '@/shared/lib/cn'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MosaicDesktop, MozaikPage, PageBody, PageHero } from '@/shared/ui/mozaik'
import { huInt } from '@/shared/lib/huNum'

// Adatböngésző — /admin/data (mezo-d5iy.12), ported from admin-body.html's #d-data: view- and
// table- and user-pickers, one dense `.ad-table` with jsonb/FK cells, paging.
//
// `useSearchParams` is the source of truth (not local state) so a reload and an FK jump both
// restore the exact same screen — every picker/toggle/sort/page mutation below goes through
// `patch`, which merges into the CURRENT search params rather than replacing them.
//
// No table selected is the page's initial state (every picker starts unselected — task brief).
// That is checked directly against the `table` STRING, not `rows.isPending`: Task 11's bug
// (mezo-d5iy.11 fix round 1) was inferring a terminal state from `isPending` on a hook that
// `useDualQuery` can leave permanently `pending` when `enabled: false` and nothing is cached.
// `useAdminRows` now folds its own `enabled` into `isPending` (final review Finding 3), so that
// class of hang is fixed at the hook boundary too — but `table === ''` is a local value the
// page already controls, so branching on it directly stays the simplest correct check.
export function AdminDataPage() {
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const table = searchParams.get('table') ?? ''
  const view = searchParams.get('view') ?? ''
  const userId = searchParams.get('userId') ?? ''
  const page = Number(searchParams.get('page') ?? '0') || 0
  const sort = searchParams.get('sort')
  const dir: AdminRowSortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  // Fix round 1 (Finding 3): the FK jump's `?rowId=` — consumed client-side only (DataTable
  // highlights the matching row within the page already loaded; see its own doc comment for
  // why there's no backend param and no guarantee the row is on this page at all).
  const rowId = searchParams.get('rowId')

  const tables = useAdminTables(isOwner)
  const views = useAdminViews(isOwner)
  const rows = useAdminRows(
    { table, userId: userId || null, page, sort, dir, includeDeleted },
    isOwner && table !== '',
  )

  function patch(next: Record<string, string | null>) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      Object.entries(next).forEach(([k, v]) => {
        if (v === null || v === '') p.delete(k)
        else p.set(k, v)
      })
      return p
    })
  }

  // `rowId` is cleared on any explicit table change — an FK jump's highlight target belongs to
  // the table it pointed at, not to whatever table the owner picks next (Fix round 1, Finding 3).
  const selectTable = (name: string) => patch({ table: name, view: null, sort: null, dir: null, page: null, userId: null, rowId: null })
  const selectView = (v: AdminViewDescriptor) =>
    patch({ view: v.id, table: v.table, sort: v.defaultSort, dir: v.defaultDir, page: null, rowId: null })
  const selectUser = (id: string | null) => patch({ userId: id, page: null })
  const toggleDeleted = () => patch({ includeDeleted: includeDeleted ? null : 'true', page: null })
  const toggleSort = (col: string) => {
    if (col === sort) patch({ dir: dir === 'asc' ? 'desc' : 'asc' })
    else patch({ sort: col, dir: 'desc', page: null })
  }
  const nextPage = () => patch({ page: String(page + 1) })
  const prevPage = () => patch({ page: String(Math.max(0, page - 1)) })
  const navigateToRow = (refTable: string, rowId: unknown) => {
    navigate(`/admin/data?table=${encodeURIComponent(refTable)}&rowId=${encodeURIComponent(String(rowId))}`)
  }

  const rowsTileQuery = { isError: rows.isError, refetch: rows.refetch }
  const canPrev = page > 0
  const canNext = (page + 1) * (rows.data.size || 1) < rows.data.total

  return (
    <MozaikPage tone="lav">
      <PageHero name="Adatböngésző" sub="nyers sorok · csak olvasás · nincs export" />
      <PageBody>
        <EntranceGroup>
          <div className="ad-pick">
            <span className="lbl">Nézet</span>
            <div className="ad-chiprow">
              {views.data.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={cn('ad-chip', view === v.id && 'on')}
                  aria-pressed={view === v.id}
                  onClick={() => selectView(v)}
                >
                  {v.label}
                </button>
              ))}
              <span className="ad-mut" style={{ fontSize: 10 }}>kényelmi nézet = előre beállított tábla + rendezés</span>
            </div>
          </div>

          <TablePicker tables={tables.data.tables} value={table} onChange={selectTable} />
          <UserPicker isOwner={isOwner} value={userId} onChange={selectUser} />

          <MosaicDesktop>
            <AdminTile
              query={rowsTileQuery}
              wash="sage"
              eyebrow={table === '' ? 'Válassz egy táblát' : `${table} · ${huInt(rows.data.total)} sor`}
              span={12}
            >
              {table === '' ? (
                <p className="ad-mut">Válassz egy táblát a fenti listából, vagy indulj egy kényelmi nézetből.</p>
              ) : (
                <>
                  <div className="ad-cell" style={{ justifyContent: 'space-between' }}>
                    <label className="ad-chip">
                      <input
                        type="checkbox"
                        checked={includeDeleted}
                        onChange={toggleDeleted}
                        style={{ marginRight: 6 }}
                      />
                      Törölt sorok
                    </label>
                  </div>
                  <div className="ad-scroll" style={{ marginTop: 9 }}>
                    <DataTable
                      page={rows.data}
                      sort={sort}
                      dir={dir}
                      onSort={toggleSort}
                      onNavigateToRow={navigateToRow}
                      highlightRowId={rowId}
                    />
                  </div>
                  <div className="ad-cell" style={{ marginTop: 9, justifyContent: 'space-between' }}>
                    <button type="button" className="ad-chip" disabled={!canPrev} onClick={prevPage}>‹ Előző</button>
                    <span className="ad-mut">{page + 1}. oldal · {rows.data.size}/oldal</span>
                    <button type="button" className="ad-chip" disabled={!canNext} onClick={nextPage}>Következő ›</button>
                  </div>
                  <p className="ad-note9">
                    A <code style={{ fontFamily: 'ui-monospace, monospace' }}>jsonb</code> cella kattintásra nyílik ki
                    helyben, az FK-cella a hivatkozott tábla ugyanezen böngészőjére visz. A soft-delete-elt sorok
                    alapból rejtve — a Törölt sorok kapcsoló hozza vissza őket.
                  </p>
                </>
              )}
            </AdminTile>
          </MosaicDesktop>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
