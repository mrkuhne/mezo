// ============================================================
// Mezo · Proaktív coaching — the day's verdict split as a graphic (mezo-6269.3).
// Data drawn as a graphic, per design 2.0: one segment per rule, in state
// order, so the ring IS the day. Tokens only — dark mode follows.
// ============================================================
import type { CoachingSplit } from '@/features/insights/logic/coachingCopy'

const STATE_STROKE: Array<[keyof Omit<CoachingSplit, 'total'>, string, string]> = [
  ['raised', 'var(--mz-stch-act-ink)', 'jelzett'],
  ['suppressed', 'var(--mz-stch-pend-ink)', 'pihenőn'],
  ['clear', 'var(--mz-stch-ok-ink)', 'rendben'],
  ['unavailable', 'var(--mz-stch-mut-ink)', 'nem mérhető'],
]

/** The split as a segmented ring. Renders NOTHING when the day has no rules — an unresolved or
 *  never-evaluated day must not draw a full circle of calm (the honest-states rule). */
export function VerdictArc({ split, size = 96 }: { split: CoachingSplit; size?: number }) {
  if (split.total === 0) return null
  const r = size / 2 - 7
  const c = 2 * Math.PI * r
  const seg = c / split.total
  const gap = Math.min(3, seg * 0.35)
  const label = STATE_STROKE
    .filter(([key]) => split[key] > 0)
    .map(([key, , word]) => `${split[key]} ${word}`)
    .join(', ')

  let index = 0
  const segments = STATE_STROKE.flatMap(([key, stroke]) =>
    Array.from({ length: split[key] }, () => {
      const offset = -index * seg
      index += 1
      return (
        <circle key={`${key}-${index}`} className="mzo-arcseg" cx={size / 2} cy={size / 2} r={r}
          stroke={stroke} strokeDasharray={`${seg - gap} ${c - seg + gap}`} strokeDashoffset={offset} />
      )
    }),
  )

  return (
    <svg className="mzo-arc" width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      role="img" aria-label={label}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>{segments}</g>
    </svg>
  )
}
