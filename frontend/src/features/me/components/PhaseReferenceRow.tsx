/** The bar spans 0-40% of total sleep — wide enough that both reference bands and any
 *  realistic value land inside it without a scale label. */
const SCALE_PCT = 40

/**
 * One reference row (mezo-fk9a). Verdicts are LOCATIONAL by design (spec section 9): the band
 * is sage, never red, and the copy says where the value sits — never that it is wrong.
 */
export function PhaseReferenceRow({
  label,
  pct,
  range,
  color,
}: {
  label: string
  pct: number
  range: { lo: number; hi: number }
  color: string
}) {
  const verdict = pct < range.lo ? 'a sáv alatt' : pct > range.hi ? 'a sáv felett' : 'a sávban'
  return (
    <div className="phref">
      <div className="phref-t">
        {label} <b>{Math.round(pct)}%</b>
        <em>{verdict} · ref {range.lo}–{range.hi}%</em>
      </div>
      <div className="phref-bar">
        <span
          className="phref-band"
          style={{
            left: `${(range.lo / SCALE_PCT) * 100}%`,
            width: `${((range.hi - range.lo) / SCALE_PCT) * 100}%`,
          }}
        />
        <span
          className="phref-pin"
          style={{ left: `${Math.min(100, (pct / SCALE_PCT) * 100)}%`, background: color }}
        />
      </div>
    </div>
  )
}
