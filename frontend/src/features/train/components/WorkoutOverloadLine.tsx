// ============================================================
// Mezo · WorkoutOverloadLine (mezo-e1ii9, fix round 1) — the day-level
// progressive-overload tally, at the head of the card list.
//
// The backend's `OverloadSummary` (mezo-88iwa.4) counts how many exercises move
// via each lever TODAY. It shipped precisely so a load DROP is never reported as
// `+súly`: `weightUp` counts INCREASES only, a grind back-off lands in
// `weightDown`. Its only surface used to be the prep mosaic's Fejlődés page,
// which retired with the mosaic — this quiet strip is its home now, above the
// first `.wo-card` inside `.wo-list`, carrying the SAME honest copy:
//   · any up-move    → a clay `i-growth` + "Túlterhelés" + every lever spelled out, both
//                       directions. The glyph is CLAY, never an emoji (the Titanium global
//                       constraint) — the ⚡ this strip first shipped with was exactly the
//                       artefact §21 row 11 of the parity matrix lists for removal.
//   · drops only     → "Visszavett súlyok" + "A visszavett súly is a terv része —
//                       innen indul a következő emelkedés."
// A day that moves nothing (or carries no summary at all) renders NOTHING — the
// honest-empty rule: the strip never fabricates a number it wasn't given.
// ============================================================
import { ClayIcon } from '@/shared/ui/clay'
import type { OverloadSummary } from '@/data/types'

/** The lever chips, in the shipped order — up-weight, up-rep, then the honest down-weight. */
export function overloadParts(o: OverloadSummary): string[] {
  return [
    o.weightUp > 0 ? `${o.weightUp}× +súly` : null,
    o.repUp > 0 ? `${o.repUp}× +rep` : null,
    o.weightDown > 0 ? `${o.weightDown}× −súly` : null,
  ].filter((s): s is string => s !== null)
}

export function WorkoutOverloadLine({ overload }: { overload?: OverloadSummary | null }) {
  if (!overload) return null
  const ups = overload.weightUp + overload.repUp
  if (ups + overload.weightDown === 0) return null
  return (
    <div className="wo-overload">
      <span className="wo-overload-title">
        {ups > 0 && <ClayIcon name="i-growth" size={14} className="wo-overload-icon" />}
        {ups > 0 ? 'Túlterhelés' : 'Visszavett súlyok'} · {overloadParts(overload).join(' · ')}
      </span>
      <span className="wo-overload-why">
        {ups === 0
          ? 'A visszavett súly is a terv része — innen indul a következő emelkedés.'
          : 'Ezek a gyakorlatok adják az XP-lökés nagyját ma.'}
      </span>
    </div>
  )
}
