// Admin hub matrix grid (mezo-d5iy.11) — feature × day usage matrix (also reusable for any
// row × column numeric matrix). A <table> (not the prototype's CSS-grid `.ad-matrix`) per the
// task brief: a real table gives row/column headers, a sticky first column via CSS (`.rowh`,
// prototype.css §Admin hub graphics) and per-cell `aria-label`s a test can address, without a
// charting library. Cell background alpha is scaled by value/max (0 stays a flat neutral tint,
// never invisible), `title` carries the exact number for a mouse-hover reader.
export interface MatrixGridProps<R, C> {
  rows: R[]
  columns: C[]
  rowKey: (row: R) => string
  rowLabel: (row: R) => string
  columnKey: (col: C) => string
  columnLabel: (col: C) => string
  valueOf: (row: R, col: C) => number
  formatValue: (value: number) => string
  /** Base hex color the cell alpha scales against — defaults to the admin accent. */
  color?: string
}

export function MatrixGrid<R, C>({
  rows,
  columns,
  rowKey,
  rowLabel,
  columnKey,
  columnLabel,
  valueOf,
  formatValue,
  color = '#A84A26',
}: MatrixGridProps<R, C>) {
  const values = rows.flatMap((r) => columns.map((c) => valueOf(r, c)))
  const max = Math.max(1, ...values)
  return (
    <div className="ad-matrixwrap">
      <table className="ad-matrixtable">
        <thead>
          <tr>
            <th className="rowh">Feature</th>
            {columns.map((c) => (
              <th key={columnKey(c)}>{columnLabel(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              <td className="rowh">{rowLabel(r)}</td>
              {columns.map((c) => {
                const v = valueOf(r, c)
                const alpha = v > 0 ? 0.16 + 0.84 * (v / max) : 0.06
                return (
                  <td
                    key={columnKey(c)}
                    className="cell"
                    style={{ background: hexToRgba(color, alpha) }}
                    title={`${v}`}
                    aria-label={`${rowLabel(r)} · ${columnLabel(c)}: ${formatValue(v)}`}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
}
