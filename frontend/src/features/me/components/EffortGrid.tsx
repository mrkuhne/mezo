// ============================================================
// Mezo · EffortGrid (mezo-9k99) — the four Fogg ability factors as three-grade segment rows,
// with the derived difficulty + XP readout and the "make it tiny" advice on the heaviest
// factor. One block, two hosts (prototype `renderEffort`): the wizard's act step and the
// habit editor's „Mennyibe kerül?" card. The XP is READ here, never set — that is the point.
// ============================================================
import {
  EFFORT_ADVICE, EFFORT_FACTORS, effortLevel, effortWeakest, effortXp,
  type EffortState,
} from '@/features/me/logic/habitEffort'
import { cn } from '@/shared/lib/cn'

const TONES = ['is-sage', 'is-gold', 'is-coral'] as const

export function EffortGrid({ value, onChange, xpOverride }: {
  value: EffortState
  onChange: (next: EffortState) => void
  /** Shown instead of the derived XP while the grid is unrated (a stored value being kept). */
  xpOverride?: number
}) {
  const level = effortLevel(value)
  const weakest = effortWeakest(value)
  return (
    <>
      {EFFORT_FACTORS.map((f) => (
        <div key={f.key} className="rt-effrow">
          <div className="rt-effrow-h">
            <b>{f.label}</b>
            <small>{f.hint}</small>
          </div>
          <div className="rt-seg3" role="group" aria-label={f.label}>
            {f.opts.map((opt, grade) => (
              <button
                key={opt}
                type="button"
                className={cn(TONES[grade], value[f.key] === grade && 'on')}
                aria-pressed={value[f.key] === grade}
                onClick={() => onChange({ ...value, [f.key]: grade as 0 | 1 | 2 })}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="rt-effout" data-testid="effort-out">
        <span className="rt-effout-lvl">
          {level.label}
          <small>{level.sub}</small>
        </span>
        <span className="rt-effout-xp">
          <b>{xpOverride ?? effortXp(value)}</b>
          <small>XP / alkalom</small>
        </span>
      </div>
      {weakest != null && (
        <div className="rt-tip is-warn" data-testid="effort-tiny">
          <span aria-hidden="true">✂</span>
          <span>{EFFORT_ADVICE[weakest]}</span>
        </div>
      )}
    </>
  )
}
