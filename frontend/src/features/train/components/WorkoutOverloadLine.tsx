// ============================================================
// Mezo · WorkoutOverloadLine (mezo-e1ii9; Folyadék: mezo-n4wf5.4) — the day-level
// progressive-overload tally, one row of the Eligazítás („Ma itt lépünk előre").
//
// The backend's `OverloadSummary` (mezo-88iwa.4) counts how many exercises move
// via each lever TODAY. It shipped precisely so a load DROP is never reported as
// `+súly`: `weightUp` counts INCREASES only, a grind back-off lands in
// `weightDown`. The row carries the SAME honest copy as before:
//   · any up-move    → the `t-up` glyph + "Túlterhelés" + every lever spelled out, both
//                       directions. The glyph is a sprite icon, never an emoji.
//   · drops only     → the `t-down` glyph + "Visszavett súlyok" + "A visszavett súly is a
//                       terv része — innen indul a következő emelkedés."
// A day that moves nothing (or carries no summary at all) renders NOTHING — the
// honest-empty rule: the row never fabricates a number it wasn't given. `overloadMoves`
// tells the caller the same thing, so the section heading above it disappears with it.
// Build target: docs/design_2.0/prototypes/vilagos/edzes.js `overLine()` + its `rw` in `indulas()`.
// ============================================================
import type { OverloadSummary } from '@/data/types'
import { Row } from '@/shared/ui/folyadek'

/** The lever chips, in the shipped order — up-weight, up-rep, then the honest down-weight. */
export function overloadParts(o: OverloadSummary): string[] {
  return [
    o.weightUp > 0 ? `${o.weightUp}× +súly` : null,
    o.repUp > 0 ? `${o.repUp}× +ism.` : null,
    o.weightDown > 0 ? `${o.weightDown}× −súly` : null,
  ].filter((s): s is string => s !== null)
}

/** True when the day moves at least one exercise (up or down) — i.e. when the line renders. */
export function overloadMoves(o?: OverloadSummary | null): o is OverloadSummary {
  return !!o && o.weightUp + o.repUp + o.weightDown > 0
}

export function WorkoutOverloadLine({ overload }: { overload?: OverloadSummary | null }) {
  if (!overloadMoves(overload)) return null
  const ups = overload.weightUp + overload.repUp
  return (
    <Row
      className="ei-ovl"
      icon={ups > 0 ? 't-up' : 't-down'}
      title={`${ups > 0 ? 'Túlterhelés' : 'Visszavett súlyok'} · ${overloadParts(overload).join(' · ')}`}
      sub={ups > 0
        ? 'Ezeken a gyakorlatokon lépünk ma előre.'
        : 'A visszavett súly is a terv része — innen indul a következő emelkedés.'}
    />
  )
}
