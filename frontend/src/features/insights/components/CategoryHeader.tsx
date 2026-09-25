/** Üveg (U9 · mezo-me75u.9): the kind list's section head — an unboxed title row in the
 *  kind's accent, the closed-header-already-tells-the-story idiom (no card/shadow). */
export function CategoryHeader({ label, color, count }: { label: string; color: string; count: number }) {
  return (
    <div className="tud9-lsec">
      <h2 className="tud9-sech" style={{ color }}>{label} · {count}</h2>
    </div>
  )
}
