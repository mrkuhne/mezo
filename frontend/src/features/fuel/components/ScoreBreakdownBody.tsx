// ============================================================
// Mezo · ScoreBreakdownBody (shared score-breakdown sections)
// „Miből áll össze" head + the Σ ledger tile + the Mozaik 2.0 dimension MOSAIC
// (one wash tile per dimension, staggered entrance) + the „Lehetne jobb" gain cards.
// Used by MealScoreSheet (meal score) and RecipeScoreSheet (template breakdown,
// mezo-bw3y / F7.3). One body, two callers, so the two surfaces stay pixel-identical.
//
// mezo-jcpt.1: the MEAL surface hands the improve list to its Mezo card as action chips
// and passes an empty `improve` here, so the same suggestion is never shown twice; the
// recipe surface (which has no coach card) keeps the stacked gain cards below.
// ============================================================
import type { MealBreakdown } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { formatImpact } from '@/features/fuel/logic/formatImpact'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { DimensionCard } from '@/features/fuel/components/DimensionCard'
import { ScoreLedger } from '@/features/fuel/components/ScoreLedger'
// A súlyozott Σ (a volt `totalOf`) kiemelve, hogy az új FuelMealScorePage UGYANAZT a számot
// mondja, ne egy másolt aritmetikát (mezo-33k6).
import { breakdownTotalPct } from '@/features/fuel/logic/scoreArithmetic'

const PONT_RE = /^([+−]\d+) pont$/

/**
 * „Miből áll össze" head + the Σ ledger tile, as its OWN section (mezo-1f7b).
 * MealScoreSheet renders it directly under the hero — ABOVE the Mezo olvasat card — because the
 * arithmetic is what the coach's prose then interprets; reading the verdict before ever seeing
 * where the number came from was the wrong order. RecipeScoreSheet has no coach card, so it keeps
 * getting it from ScoreBreakdownBody in place.
 */
export function ScoreLedgerSection({ breakdown, scorePct }: {
  breakdown: MealBreakdown
  scorePct?: number
}) {
  return (
    <>
      <div className="sb-sec">
        <Eyebrow>Miből áll össze a {breakdownTotalPct(breakdown, scorePct)}</Eyebrow>
        <span className="sb-sec-r">{breakdown.dimensions.length} dimenzió · súlyozva</span>
      </div>
      <ScoreLedger dimensions={breakdown.dimensions} />
    </>
  )
}

export function ScoreBreakdownBody({ breakdown, scorePct, ledger = true }: {
  breakdown: MealBreakdown
  /** The headline score the head names; omitted → the weighted Σ of the dimensions (RecipeScoreSheet). */
  scorePct?: number
  /** false when the caller already rendered {@link ScoreLedgerSection} higher up (MealScoreSheet). */
  ledger?: boolean
}) {
  const b = breakdown
  return (
    <>
      {ledger && <ScoreLedgerSection breakdown={b} scorePct={scorePct} />}
      {/* The mosaic: live dimensions first (rich, washed), the ghosts last — a degraded
          dimension is named, not hidden, but it never outranks a scoring one. The 40ms
          stagger is the prototype's entrance choreography, and it only RUNS inside an
          EntranceGroup: the `.rise` keyframe is scoped to `.mz-play .rise`, and a sheet
          portals to `.phone-screen`, which is an ancestor of the pages that arm it — so
          without this wrapper the class would be dead markup (mezo-jcpt.1). */}
      <EntranceGroup className="sb-mosaic">
        {[...b.dimensions]
          .sort((x, y) => (y.weight > 0 ? 1 : 0) - (x.weight > 0 ? 1 : 0))
          .map((d, i) => <DimensionCard key={`${d.id}-${i}`} dim={d} delayMs={60 + i * 40} />)}
      </EntranceGroup>

      {b.improve && b.improve.length > 0 && (
        <>
          <div className="sb-sec">
            <Eyebrow className="text-warning">Lehetne jobb</Eyebrow>
            <span className="sb-sec-r">{b.improve.length} javaslat</span>
          </div>
          <div className="col gap-sm">
            {b.improve.map((it, i) => {
              // "+0.04 score" → "+4 pont" (formatImpact); any other impact text is shown verbatim.
              const gain = formatImpact(it.impact)
              const m = PONT_RE.exec(gain)
              return (
                <div key={i} className="sb-imp">
                  <p><SafeMarkdown text={it.text} /></p>
                  <span className="sb-imp-gain">{m ? <>{m[1]}<small>pont</small></> : gain}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
