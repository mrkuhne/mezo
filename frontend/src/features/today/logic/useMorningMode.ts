// A napom morning mode as a live value (mezo-yjzhw.4, review round 1). `isMorningMode` reads
// `localStorage`, which React cannot see change — so the tab dot used to linger until some
// unrelated re-render after `markSeen`. This subscribes to `markSeen`'s own `napom:seen` event
// (and to `storage`, for another tab of the app) and re-reads on each.
import { useSyncExternalStore } from 'react'
import type { NormalizedDayEvaluation } from '@/data/me/dayEvaluation'
import { NAPOM_SEEN_EVENT, isMorningMode } from '@/features/today/logic/napom'

function subscribe(onChange: () => void): () => void {
  window.addEventListener(NAPOM_SEEN_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(NAPOM_SEEN_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** `yesterday` — yesterday's normalized evaluation, or null while it is unknown. */
export function useMorningMode(yesterday: NormalizedDayEvaluation | null): boolean {
  return useSyncExternalStore(subscribe, () => isMorningMode(yesterday), () => false)
}
