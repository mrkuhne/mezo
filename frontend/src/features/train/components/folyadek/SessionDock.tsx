// Edzés · the floating bar of the session (mezo-n4wf5.4; prototype vilagos/edzes.js `dock`, `.vs-rest`, `.vs-rv`).
// Always there in the active phase: between sets it is the done work as a level + „Lezárás"; during a rest it is the
// vessel that drains with the countdown. Presentational; the page owns the timer (`useRestTimer`) and the finish.
// Portalled into `.phone-screen` like the dock it replaces (a sticky child of the scroller would sit above its bottom
// padding and scroll away with the list). CSS: `.ex-dock`, `.ex-rest`, `.ex-rv`.
import { createPortal } from 'react-dom'
import { Btn, LevelMarks } from '@/shared/ui/folyadek'
import { fmtMMSS } from '../../logic/restTimer'

export interface SessionDockProps {
  resting: boolean
  /** Seconds left of the rest / its total (the vessel's level is `remaining / total`). */
  remaining: number
  total: number
  /** Whose rest it is. */
  exerciseName: string | null
  /** `dockNumbers(session)`: done / planned sets over the non-skipped exercises. */
  doneSets: number
  plannedSets: number
  onExtend: () => void
  onSkipRest: () => void
  onFinish: () => void
  finishDisabled: boolean
}

export function SessionDock(p: SessionDockProps) {
  const target = document.querySelector('.phone-screen') ?? document.body
  const level = p.total > 0 ? Math.max(0, Math.min(100, (p.remaining / p.total) * 100)) : 0
  return createPortal(
    <div className={p.resting ? 'fo-foot nonav ex-dock is-resting' : 'fo-foot nonav ex-dock'} role="status">
      {p.resting ? (
        <>
          <span className="ex-rest">
            <span className="ex-rv" aria-hidden="true"><i style={{ height: `${level}%` }} /></span>
            <span className="g"><strong>{fmtMMSS(p.remaining)}</strong><small aria-live="polite">pihenő{p.exerciseName ? ` · ${p.exerciseName}` : ''}</small></span>
          </span>
          <Btn sm ghost onClick={p.onExtend}>+30 mp</Btn>
          <Btn sm onClick={p.onSkipRest}>Tovább</Btn>
        </>
      ) : (
        <>
          <span className="ex-rest idle">
            <span className="g">
              <small aria-live="polite">Elvégzett munka</small>
              <strong>{p.doneSets} / {p.plannedSets} szett</strong>
              <LevelMarks pct={p.plannedSets > 0 ? (p.doneSets / p.plannedSets) * 100 : 0} height={10} />
            </span>
          </span>
          <Btn sm disabled={p.finishDisabled} onClick={p.onFinish}>Lezárás</Btn>
        </>
      )}
    </div>,
    target,
  )
}
