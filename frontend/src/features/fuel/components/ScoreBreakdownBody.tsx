// ============================================================
// Mezo · ScoreBreakdownBody (shared score-breakdown sections)
// „Miből áll össze" head + ScoreLedger + collapsible DimensionCards + „Lehetne jobb"
// gain cards — used by MealScoreSheet (meal score) and RecipeScoreSheet (template
// breakdown, mezo-bw3y / F7.3). One body, two callers, so the two surfaces stay
// pixel-identical. Logolás 2.1 (mezo-zeeq) retired the „Hogyan számoltam" tool
// list from here — it was noise in a details view (ToolChipRow lives on elsewhere).
// ============================================================
import type { MealBreakdown } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { formatImpact } from '@/features/fuel/logic/formatImpact'
import { DimensionCard } from '@/features/fuel/components/DimensionCard'
import { ScoreLedger } from '@/features/fuel/components/ScoreLedger'

const PONT_RE = /^([+−]\d+) pont$/

export function ScoreBreakdownBody({ breakdown, scorePct }: {
  breakdown: MealBreakdown
  /** The headline score the head names; omitted → the weighted Σ of the dimensions (RecipeScoreSheet). */
  scorePct?: number
}) {
  const b = breakdown
  const total = scorePct ?? Math.round(b.dimensions.reduce((s, d) => s + d.weight * d.score * 100, 0))
  return (
    <>
      <div className="sb-sec">
        <Eyebrow>Miből áll össze a {total}</Eyebrow>
        <span className="sb-sec-r">{b.dimensions.length} dimenzió · súlyozva</span>
      </div>
      <ScoreLedger dimensions={b.dimensions} />
      <div className="col gap-sm" style={{ marginTop: 8 }}>
        {b.dimensions.map(d => <DimensionCard key={d.id} dim={d} />)}
      </div>

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
