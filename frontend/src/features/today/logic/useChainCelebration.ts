// ============================================================
// Mezo · useChainCelebration — the quiet „🌅 Tökéletes reggel" / „🌙 Tökéletes este"
// toast the retired `RoutineCard` fired when its visible chain completed (mezo-j7u4).
// Restored verbatim, including its `wasComplete` ref: the toast fires on the EDGE into
// completion, so a re-render of an already-complete chain stays silent. Mounting with an
// already-complete chain does celebrate — that was RoutineCard's behaviour too (it
// remounted on every Today visit), and parity beats a silent behaviour change.
// Feature-local logic hook: the face that owns a chain calls it, nobody else.
// ============================================================
import { useEffect, useRef } from 'react'
import { emitToast } from '@/shared/lib/toastBus'

export function useChainCelebration(complete: boolean, text: string): void {
  const wasComplete = useRef(false)
  useEffect(() => {
    if (complete && !wasComplete.current) {
      emitToast({ kind: 'success', text })
    }
    wasComplete.current = complete
  }, [complete, text])
}
