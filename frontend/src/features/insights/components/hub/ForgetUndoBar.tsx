import { useEffect, useState } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { undoSub, undoTitle, VERB } from '@/features/insights/logic/hubCopy'
import { UNDO_MS, type ForgetRequest } from '@/features/insights/hooks/useForgetUndo'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'

/** The prototype's `#undo` bar: glass, fixed above the tab bar, a 5→0 countdown and a draining
 *  bar. The bar's CSS keyframe animation (ported with the rest of the hub's styles) carries a
 *  reduced-motion branch that steps the width once per second instead of animating continuously;
 *  the number here (updated every 250 ms off wall-clock time, not the CSS) is always exact and
 *  needs no reduced-motion branch of its own. */
export function ForgetUndoBar({ pending, onUndo }: {
  pending: (ForgetRequest & { startedAt: number }) | null
  onUndo: () => void
}) {
  const [left, setLeft] = useState(UNDO_MS / 1000)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!pending) return
    const tick = () => setLeft(Math.max(0, Math.ceil((UNDO_MS - (Date.now() - pending.startedAt)) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [pending])
  if (!pending) return null
  return (
    <div className="th-undo glass on" role="status" aria-live="polite" key={pending.key}>
      <div className="r"><Icon3D name="t-eraser" size={22} /><b>{undoTitle(pending.label)}</b></div>
      <div className="r2">
        <small>{undoSub(pending.computed)}</small>
        <button type="button" className="u" onClick={onUndo}>{VERB.undo}<i aria-hidden="true">{left}</i></button>
      </div>
      <div className="bar2" aria-hidden="true">
        <b
          className={reduced ? 'still' : undefined}
          style={reduced ? { width: `${(left / (UNDO_MS / 1000)) * 100}%` } : { animationDuration: `${UNDO_MS}ms` }}
        />
      </div>
    </div>
  )
}
