// ============================================================
// Mezo · FormationCurve (mezo-08zl) — prototype `rutin-formalodas` `.curvewrap` ×1.18.
//
// The saturating curve `1 - e^(-k*n)` drawn over REPETITIONS (not calendar days — the axis
// says so, because that distinction is the whole model). Three things share one picture:
//   · the solid stretch = repetitions actually done,
//   · the dashed stretch = the projection,
//   · the pale band around it = the uncertainty of k (±kBand), because a single line would
//     claim a precision the literature does not support.
// Purely presentational: every number arrives as a prop, so the drawing is testable and
// cannot disagree with the estimate the card prints beside it.
// ============================================================
import { curveY, repsAtThreshold } from '@/features/me/logic/habitFormation'

const W = 340
const H = 118
const PAD_L = 6
const PAD_R = 10
const PAD_T = 14
const PAD_B = 18
const BAND = 0.3 // must mirror mezo.habit.formation.k-band

export interface FormationCurveProps {
  /** Growth rate of the fitted curve; null when there is not enough data to fit one. */
  curveK: number | null
  reps: number
  thresholdPct: number
}

const STEPS = 48

/** Sample the curve between two repetition counts, in screen coordinates. */
function samples(
  k: number, from: number, to: number,
  x: (n: number) => number, y: (v: number) => number,
): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let i = 0; i <= STEPS; i++) {
    const n = from + ((to - from) * i) / STEPS
    out.push([x(n), y(curveY(k, n))])
  }
  return out
}

function toPath(pts: Array<[number, number]>): string {
  return pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
}

export function FormationCurve({ curveK, reps, thresholdPct }: FormationCurveProps) {
  // Without a fitted k there is nothing honest to draw — the caller shows the null state.
  if (curveK == null || curveK <= 0) {
    return null
  }
  const kLo = curveK * (1 - BAND) // the slower curve — the pessimistic edge of the band
  const kHi = curveK * (1 + BAND)
  // Enough horizon to show where the threshold lands even on the slow edge, plus a little air.
  const maxN = Math.max(repsAtThreshold(kLo, thresholdPct) * 1.08, reps * 1.25, 10)
  const x = (n: number) => PAD_L + (n / maxN) * (W - PAD_L - PAD_R)
  const y = (v: number) => H - PAD_B - v * (H - PAD_T - PAD_B)
  const nowX = x(Math.min(reps, maxN))
  const nowY = y(curveY(curveK, reps))
  const thrY = y(thresholdPct / 100)
  const pastPath = toPath(samples(curveK, 0, Math.min(reps, maxN), x, y))

  return (
    <svg className="rt-curve" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`A formálódás görbéje: ${reps} ismétlésnél tartasz.`}>
      <defs>
        <linearGradient id="rt-curve-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--amber)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--amber)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Uncertainty band: out along the fast edge, back along the slow one. Built from
          explicit point lists — reversing a path STRING would put the M at the wrong end. */}
      <path className="rt-curve-band"
        d={`${toPath(samples(kHi, 0, maxN, x, y))} ${samples(kLo, 0, maxN, x, y).reverse()
          .map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join(' ')} Z`} />
      <line className="rt-curve-thr" x1={PAD_L} y1={thrY} x2={W - PAD_R} y2={thrY} />
      <text className="rt-curve-thrlb" x={W - PAD_R} y={thrY - 4} textAnchor="end">magától megy</text>
      {/* projection first, so the solid past draws over its start */}
      <path className="rt-curve-next" d={toPath(samples(curveK, Math.min(reps, maxN), maxN, x, y))} />
      <path className="rt-curve-fill"
        d={`${pastPath} L${nowX.toFixed(1)},${(H - PAD_B).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD_B).toFixed(1)} Z`} />
      <path className="rt-curve-past" d={pastPath} />
      <circle className="rt-curve-dot" cx={nowX} cy={nowY} r="4" />
      <text className="rt-curve-ax" x={PAD_L} y={H - 5}>0 ismétlés</text>
      <text className="rt-curve-ax" x={W - PAD_R} y={H - 5} textAnchor="end">{Math.round(maxN)}</text>
    </svg>
  )
}
