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
// `role="status"` matches the prototype: the dock is an ambient status region, not an
// alert. `aria-live` sits on the non-ticking LABEL span only (fix wave M2): the mm:ss
// strong re-renders once a SECOND, and with aria-live on the dock root a screen reader
// announced the whole dock on every tick for the entire rest. The label ("PIHENŐ · X" ↔
// "ELVÉGZETT MUNKA") changes only when the dock changes state, which is exactly the
// transition worth announcing.
//
// PORTALLED (fix wave C1): `.wo-dock` is `position: absolute; bottom: 0`, so rendered in
// place it anchored to the nearest positioned ancestor INSIDE the scrolling
// `.screen-content` and scrolled away with the card list (measured top −1630px at max
// scroll). It now portals into `.phone-screen` — the phone frame itself, `position:
// relative` — exactly the way GlassBox.tsx does, so `bottom: 0` means the frame's bottom.
// Same fallback (`document.body`), and the target is re-queried on every render rather
// than cached, for the same reason GlassBox re-queries: `.phone-screen` may not exist yet
// when this component first mounts. The dock is rendered only by the active phase, so the
// portal unmounts with it.
//
// Üvegesítés U4 (mezo-me75u.4): ONE fixed glass bar with NO sheen (`.glass.is-still`, like the
// TabBar — a sweep through always-visible chrome reads as flicker). Coral while idle; while
// resting the SAME bar turns sky and the SAME ring fills around a 3D clock. Skin lives in the
// `uveg edzes session` block of prototype.css.
// ============================================================
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { fmtMMSS } from '@/features/train/logic/restTimer'
import { cn } from '@/shared/lib/cn'
import { Icon3D } from '@/shared/ui/clay'

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
    // The ring FILLS as the rest elapses (prototype session.js:493) — not a draining gauge.
    ? (total > 0 ? 100 - (remaining / total) * 100 : 0)
    : (plannedSets > 0 ? (doneSets / plannedSets) * 100 : 0)

  const target = document.querySelector('.phone-screen') ?? document.body

  return createPortal(
    <div className={cn('wo-dock glass is-still', resting && 'is-resting')} role="status">
      <span className="wo-dock-ring" style={{ '--ring': ring } as CSSProperties}>
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle className="track" cx={24} cy={24} r={20} pathLength={100} />
          <circle className="fill" cx={24} cy={24} r={20} pathLength={100} />
        </svg>
        {resting ? <Icon3D name="t-clock" size={34} className="wo-dock-clock" /> : <b>{doneSets}</b>}
      </span>
      <span className="wo-dock-copy">
        <small aria-live="polite">{resting ? `PIHENŐ · ${(exerciseName ?? '').toUpperCase()}` : 'ELVÉGZETT MUNKA'}</small>
        <strong>{resting ? fmtMMSS(remaining) : `${doneSets} / ${plannedSets} szett`}</strong>
      </span>
      {resting ? (
        <span className="wo-dock-acts">
          <button type="button" className="wo-dock-ghost" onClick={onExtend}>+30s</button>
          <button type="button" className="wo-dock-go" onClick={onSkipRest}>Kész</button>
        </span>
      ) : (
        <button type="button" className="wo-dock-finish" disabled={finishDisabled} onClick={onFinish}>
          Lezárás →
        </button>
      )}
    </div>,
    target,
  )
}
