// ============================================================
// Mezo · WorkoutDock (mezo-88iwa.7, T6 Task 6) — the fixed session-level dock at the
// bottom of the active phase, ported 1:1 from the prototype's `dock()` (docs/design_2.0/
// prototypes/companion-titanium/session.js:144-158). CONSTANT height (`.wo-dock` fixes
// it in CSS) so the card list under it never jumps as it morphs between its two states:
//
//   idle    — a progress ring (done/planned sets share), "ELVÉGZETT MUNKA" + "n / m szett",
//             and a "Lezárás →" CTA (disabled at zero logged).
//   resting — the SAME ring now reads the countdown share, "PIHENŐ · <EXERCISE>" + mm:ss,
//             and "+30s" / "Kész" actions.
//
// Purely presentational: it is driven by the page's ALREADY-EXISTING `useRestTimer()`
// instance via props (remaining/total/exerciseName) — this component owns no timer of
// its own, only the two callbacks (`onExtend`/`onSkipRest`) the resting actions fire.
// `role="status" aria-live="polite"` matches the prototype: the countdown update is an
// ambient status, not an alert.
// ============================================================
import type { CSSProperties } from 'react'
import { fmtMMSS } from '@/features/train/logic/restTimer'
import { cn } from '@/shared/lib/cn'

export interface WorkoutDockProps {
  /** True while a rest is counting down (running OR paused) — `useRestTimer().status !== 'idle'`. */
  resting: boolean
  /** Whole seconds left in the current rest — meaningless while `!resting`. */
  remaining: number
  /** Full duration of the current rest — meaningless while `!resting`. */
  total: number
  /** The exercise the current rest belongs to — null only while `!resting`. */
  exerciseName: string | null
  /** Sets logged so far this session (ALL exercises, including skipped's own logged rows). */
  doneSets: number
  /** Total planned sets this session (the idle ring's denominator). */
  plannedSets: number
  /** The dock's "+30s" — extends the running rest (resting only). */
  onExtend: () => void
  /** The dock's "Kész" — ends the rest early (resting only). */
  onSkipRest: () => void
  /** The dock's "Lezárás →" (idle only) — opens the finish confirm glass or finishes outright. */
  onFinish: () => void
  /** Disabled at zero logged sets (idle only) — mirrors the finish CTA's own zero-guard. */
  finishDisabled: boolean
}

export function WorkoutDock({
  resting, remaining, total, exerciseName, doneSets, plannedSets,
  onExtend, onSkipRest, onFinish, finishDisabled,
}: WorkoutDockProps) {
  const ring = resting
    ? (total > 0 ? (remaining / total) * 100 : 0)
    : (plannedSets > 0 ? (doneSets / plannedSets) * 100 : 0)

  return (
    <div className={cn('wo-dock', resting && 'is-resting')} role="status" aria-live="polite">
      <span className="wo-dock-ring" style={{ '--ring': ring } as CSSProperties}>
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <circle className="track" cx={22} cy={22} r={18} pathLength={100} />
          <circle className="fill" cx={22} cy={22} r={18} pathLength={100} />
        </svg>
        <b>{resting ? '' : doneSets}</b>
      </span>
      <span className="wo-dock-copy">
        <small>{resting ? `PIHENŐ · ${(exerciseName ?? '').toUpperCase()}` : 'ELVÉGZETT MUNKA'}</small>
        <strong>{resting ? fmtMMSS(remaining) : `${doneSets} / ${plannedSets} szett`}</strong>
      </span>
      {resting ? (
        <span className="wo-dock-acts">
          <button type="button" onClick={onExtend}>+30s</button>
          <button type="button" onClick={onSkipRest}>Kész</button>
        </span>
      ) : (
        <button type="button" className="wo-dock-finish" disabled={finishDisabled} onClick={onFinish}>
          Lezárás →
        </button>
      )}
    </div>
  )
}
