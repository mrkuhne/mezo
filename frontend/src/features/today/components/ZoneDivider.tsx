/**
 * Zone boundary on the Today screen (action-first re-composition, mezo-gj2y):
 * a small-caps faint label + hairline that separates the "Teendők ma" and
 * "A napod" zones. Today-local on purpose — promote to shared/ui only if a
 * second feature adopts the idiom.
 */
export function ZoneDivider({ label }: { label: string }) {
  return (
    <div className="zonediv" role="separator" aria-label={label}>
      <span>{label}</span>
    </div>
  )
}
