import { useEffect, useRef, type RefObject } from 'react'

/**
 * Close (and commit) a tap-to-edit field when the next tap lands OUTSIDE it.
 *
 * Since the „no self-opening keyboard" rule (owner decision, 2026-09-19) a tap-to-edit
 * field no longer focuses itself when it opens — the user taps the field to start typing.
 * An input that was never focused never fires `blur`, and `blur` is what those fields
 * commit on, so without this the row would sit in edit mode forever once the user taps
 * away. A focused field still commits through its own `blur`; this hook stays out of the
 * way in that case so the value is never committed twice.
 */
export function useCommitOnOutsideTap(
  active: boolean,
  ref: RefObject<HTMLElement | null>,
  commit: () => void,
) {
  // Keep the callback in a ref so a new closure per render does not re-subscribe.
  const commitRef = useRef(commit)
  commitRef.current = commit

  useEffect(() => {
    if (!active) return
    const onDown = (e: Event) => {
      const el = ref.current
      if (!el || el.contains(e.target as Node)) return
      if (document.activeElement === el) return // its own blur will commit
      commitRef.current()
    }
    // Capture phase: fires before the tapped control's own handler, so the value is
    // committed before whatever that control does with it.
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [active, ref])
}
