// ============================================================
// Mezo · FormationCurve (mezo-08zl; Folyadék F2 mezo-n4wf5.2) — „így épült": the saturating
// curve `1 - e^(-k*n)` over the REPETITIONS done so far (not calendar days — that distinction is
// the whole model), drawn as the kit's liquid surface with the „magától megy" threshold as the
// target waterline. The projection and its uncertainty band left the picture with the Üveg look:
// what is still ahead is said as a RANGE in the hero, not drawn as a line.
// Purely presentational: every number arrives as a prop, so the drawing cannot disagree with the
// estimate printed beside it.
// ============================================================
import { curveY } from '@/features/me/logic/habitFormation'
import { Area } from '@/shared/ui/folyadek'

export interface FormationCurveProps {
  /** Growth rate of the fitted curve; null when there is not enough data to fit one. */
  curveK: number | null
  reps: number
  thresholdPct: number
}

const STEPS = 24

/** The curve from 0 to `reps`, in percent — at most STEPS + 1 samples, the last one exactly at `reps`. */
export function formationSeries(curveK: number, reps: number): number[] {
  const n = Math.max(1, Math.min(STEPS, Math.round(reps)))
  return Array.from({ length: n + 1 }, (_, i) => Math.round(curveY(curveK, (reps * i) / n) * 1000) / 10)
}

export function FormationCurve({ curveK, reps, thresholdPct }: FormationCurveProps) {
  // Without a fitted k there is nothing honest to draw — the caller shows the null state.
  if (curveK == null || curveK <= 0) {
    return null
  }
  return (
    <div className="rb-curve" role="img" data-testid="formation-curve"
      aria-label={`A formálódás görbéje: ${reps} ismétlésnél tartasz, a szaggatott vonal a „magától megy” küszöb (${thresholdPct}%).`}>
      <Area values={formationSeries(curveK, reps)} target={thresholdPct} labels={['0 ismétlés', `${reps} ismétlés`]} height={120} />
    </div>
  )
}
