// ============================================================
// Mezo · useWindDownPhase — the ticking evening/night phase (mezo-mvb4.1).
// ONE derivation for the two surfaces that need it:
//   • `WindDownBanner`, which RENDERS the phase (dim / winddown / night), and
//   • `FaceEvening`, which must know when the banner owns the `wind_down` habit's own row —
//     otherwise that habit is offered twice on one screen, with two independent `pending`
//     states, which is exactly the duplication the daypart re-composition exists to remove.
// Both read the SAME `useSleepGoal()` anchor through the SAME pure `windDownPhase()`, so there
// is no second formula that could drift; each consumer keeps its own 30 s tick, and since they
// mount in the same commit the ticks stay aligned.
// `phase === null` means the anchor has not resolved yet (real mode's first frames): callers
// must render nothing rather than a phase derived from the placeholder anchor.
// ============================================================
import { useEffect, useState } from 'react'
import { useSleepGoal } from '@/data/hooks'
import { windDownPhase, type AnchorTimes, type WindDownPhase } from '@/features/today/logic/windDown'

const TICK_MS = 30_000

export function useWindDownPhase(): { phase: WindDownPhase | null; now: Date; goal: AnchorTimes } {
  const { goal, isPending } = useSleepGoal()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  return { phase: isPending ? null : windDownPhase(now, goal), now, goal }
}
