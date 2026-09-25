// ============================================================
// Mezo · Proaktív coaching — the day's verdict split as a graphic (mezo-6269.3).
// Data drawn as a graphic, per design 2.0: one segment per rule, in state
// order, so the ring IS the day. Tokens only — dark mode follows.
// `glow` is the üveg gauge (mezo-me75u.8, the coaching hub hero): the kit's
// uv-ring recipe — a faint track, glowing round-capped segments in the
// state colours (coral jelzett · amber pihenőn · sage rendben · neutral
// nem mérhető). The Mezo hub's small tile arc keeps the default look.
// ============================================================
import type { CSSProperties } from 'react'
import { cn } from '@/shared/lib/cn'
import type { CoachingSplit } from '@/features/insights/logic/coachingCopy'

type StateKey = keyof Omit<CoachingSplit, 'total'>

const STATE_STROKE: Array<[StateKey, string, string]> = [
  ['raised', 'var(--mz-stch-act-ink)', 'jelzett'],
  ['suppressed', 'var(--mz-stch-pend-ink)', 'pihenőn'],
  ['clear', 'var(--mz-stch-ok-ink)', 'rendben'],
  ['unavailable', 'var(--mz-stch-mut-ink)', 'nem mérhető'],
]

/** The üveg gauge's state colours — the same meaning the state chips carry. */
export const STATE_GLOW: Record<StateKey, string> = {
  raised: 'var(--dv-coral)',
  suppressed: 'var(--dv-amber)',
  clear: 'var(--dv-sage)',
  unavailable: 'var(--text-muted)',
}

/** The split as a segmented ring. Renders NOTHING when the day has no rules — an unresolved or
 *  never-evaluated day must not draw a full circle of calm (the honest-states rule). */
export function VerdictArc({ split, size = 96, glow = false }: {
  split: CoachingSplit
  size?: number
  /** The üveg gauge (hub hero): uv-ring track + glowing segments; the svg keeps overflow visible. */
  glow?: boolean
}) {
  if (split.total === 0) return null
  const stroke = glow ? 9 : 7
  const r = size / 2 - (glow ? 12 : 7)
  const c = 2 * Math.PI * r
  const seg = c / split.total
  // Round caps reach half a stroke past each end: the glowing gauge leaves room for them so the
  // segments stay countable; the small default arc keeps its original spacing.
  const gap = glow ? Math.min(stroke + 4, seg * 0.45) : Math.min(3, seg * 0.35)
  const label = STATE_STROKE
    .filter(([key]) => split[key] > 0)
    .map(([key, , word]) => `${split[key]} ${word}`)
    .join(', ')

  let index = 0
  const segments = STATE_STROKE.flatMap(([key, color]) =>
    Array.from({ length: split[key] }, () => {
      const offset = -index * seg
      index += 1
      return (
        <circle key={`${key}-${index}`} className={cn('mzo-arcseg', glow && 'uv-ring-prog')}
          cx={size / 2} cy={size / 2} r={r}
          stroke={glow ? undefined : color}
          style={glow ? ({ '--c': STATE_GLOW[key], '--i': index, strokeWidth: stroke } as CSSProperties) : undefined}
          data-state={glow ? key : undefined}
          strokeDasharray={`${seg - gap} ${c - seg + gap}`} strokeDashoffset={offset} />
      )
    }),
  )

  return (
    <svg className={cn('mzo-arc', glow && 'uv-ring')} width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      role="img" aria-label={label}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {glow && <circle className="uv-ring-track" cx={size / 2} cy={size / 2} r={r} style={{ strokeWidth: stroke }} />}
        {segments}
      </g>
    </svg>
  )
}
