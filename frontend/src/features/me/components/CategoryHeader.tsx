/** Mozaik re-face (mezo-d20.6.7) — prototype en-body .lsec: an unboxed eyebrow
 *  row, the closed-header-already-tells-the-story idiom (no card/shadow). */
export function CategoryHeader({ label, color, count }: { label: string; color: string; count: number }) {
  return (
    <div className="tud-lsec">
      <span className="mz-eyebrow" style={{ color }}>{label} · {count}</span>
    </div>
  )
}
