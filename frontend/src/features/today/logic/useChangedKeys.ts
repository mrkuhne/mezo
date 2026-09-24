// A napom (spec 2026-09-24 §4, mezo-yjzhw.6) — which of today's rows just changed on a live
// refetch (the 60 s poll or a write-triggered invalidation), so each plays ONE coral pulse.
// The caller hands a flat snapshot (`id → displayed value`); the hook compares it with the
// previous committed one and reports the ids whose value moved:
//   · the first snapshot, and any snapshot after a `resetKey` change (another date), is only
//     the baseline — the first render and the mock seed never pulse;
//   · `null` (loading, a past or closed day) forgets the baseline, so nothing pulses there;
//   · a key with no previous value is not a change;
//   · the set clears after `FRESH_PULSE_MS`, or is replaced by the next change.
import { useEffect, useState } from 'react'

/** The pulse's length — `@keyframes napom-fresh` in the `uveg napom` block runs the same 1.6 s. */
export const FRESH_PULSE_MS = 1600

const NONE: ReadonlySet<string> = new Set()

interface Tracked {
  resetKey: string
  serial: string | null
  snapshot: Record<string, string> | null
  fresh: ReadonlySet<string>
  /** Bumped on every reported change, so an older change's timer cannot clear a newer pulse. */
  gen: number
}

const serialize = (s: Record<string, string> | null) =>
  s == null ? null : JSON.stringify(Object.keys(s).sort().map((k) => [k, s[k]]))

export function useChangedKeys(
  snapshot: Record<string, string> | null,
  resetKey: string,
): ReadonlySet<string> {
  const serial = serialize(snapshot)
  const [t, setT] = useState<Tracked>(() => ({ resetKey, serial, snapshot, fresh: NONE, gen: 0 }))

  // Adjust-state-during-render (the React-sanctioned "previous props" pattern): the compare runs
  // on the render that carries the new snapshot, so the row wears `is-fresh` on that very commit.
  if (t.resetKey !== resetKey || t.serial !== serial) {
    const prev = t.resetKey === resetKey ? t.snapshot : null
    const changed = prev && snapshot
      ? Object.keys(snapshot).filter((k) => k in prev && prev[k] !== snapshot[k])
      : []
    setT({
      resetKey,
      serial,
      snapshot,
      fresh: changed.length > 0 ? new Set(changed) : NONE,
      gen: changed.length > 0 ? t.gen + 1 : t.gen,
    })
  }

  const { gen, fresh } = t
  useEffect(() => {
    if (fresh.size === 0) return
    const timer = setTimeout(() => {
      setT((cur) => (cur.gen === gen ? { ...cur, fresh: NONE } : cur))
    }, FRESH_PULSE_MS)
    return () => clearTimeout(timer)
  }, [gen, fresh])

  return fresh
}
