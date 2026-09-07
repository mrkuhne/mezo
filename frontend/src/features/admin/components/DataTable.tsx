import type { AdminColumnDescriptor, AdminRowPageResponse } from '@/data/admin/adminDataApi'
import { JsonCell } from '@/features/admin/components/JsonCell'

// The data browser's single tabular surface (mezo-d5iy.12) — `.ad-table`, sortable headers
// built from `page.columns` (the catalog, not a hardcoded shape: credential-looking and
// pgvector columns are simply absent from it, and this renders whatever it's given), a
// `foreignKey` cell as an `.ad-fk` link, a jsonb/object cell via JsonCell, and `null` always as
// a dimmed em dash — never an empty cell, which would be indistinguishable from a missing column.
export interface DataTableProps {
  page: AdminRowPageResponse
  sort?: string | null
  dir?: 'asc' | 'desc'
  onSort: (column: string) => void
  onNavigateToRow: (table: string, rowId: unknown) => void
}

export function DataTable({ page, sort, dir, onSort, onNavigateToRow }: DataTableProps) {
  return (
    <table className="ad-table">
      <thead>
        <tr>
          {page.columns.map((col) => (
            <SortableColHeader key={col.name} col={col} sort={sort} dir={dir} onSort={onSort} />
          ))}
        </tr>
      </thead>
      <tbody>
        {page.rows.length === 0 && (
          <tr className="norow">
            <td colSpan={Math.max(1, page.columns.length)} className="ad-mut">Nincs találat.</td>
          </tr>
        )}
        {page.rows.map((row, i) => (
          <tr key={i} className="norow">
            {page.columns.map((col) => (
              <td key={col.name}>{renderCell(col, row[col.name], onNavigateToRow)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function renderCell(col: AdminColumnDescriptor, value: unknown, onNavigateToRow: (table: string, rowId: unknown) => void) {
  if (value === null || value === undefined) {
    return <span className="ad-mut">—</span>
  }
  if (col.foreignKey && col.referencesTable) {
    const table = col.referencesTable
    return (
      <button type="button" className="ad-fk" onClick={() => onNavigateToRow(table, value)}>
        {String(value)} ↗
      </button>
    )
  }
  if (typeof value === 'object') {
    return <JsonCell value={value} />
  }
  return String(value)
}

function SortableColHeader({ col, sort, dir, onSort }: {
  col: AdminColumnDescriptor
  sort?: string | null
  dir?: 'asc' | 'desc'
  onSort: (column: string) => void
}) {
  const active = sort === col.name
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="ad-sortbtn" onClick={() => onSort(col.name)}>
        {col.name}{active && <span aria-hidden="true">{dir === 'asc' ? ' ↑' : ' ↓'}</span>}
      </button>
    </th>
  )
}
