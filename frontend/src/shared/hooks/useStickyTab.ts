import { useCallback, useState } from 'react'

// "Breadcrumb-back returns to the last tab I was on, not the default."
//
// Route-based sub-navs (Train/Fuel/Insights/Me) already remember their position
// because it lives in the URL. But the *in-view* view-switchers — the segment
// buttons rendered inside a single route (e.g. Futás's "E heti edzés · Napló ·
// Tervek", or Sport's switcher) — keep their selection in component state. So
// navigating into a detail screen (e.g. "＋ Új terv" → the builder) and back
// remounts the view and resets it to the default segment, dropping the user
// where they did NOT leave off.
//
// This hook is the global rule for those switchers: a drop-in for `useState`
// that persists the selection per stable `key` in sessionStorage, so the
// last-chosen segment is restored on return (and survives a reload within the
// session). Use it for ANY in-view tab/segment switcher instead of raw
// useState. See mezo-0h9.
const PREFIX = 'mezo-tab:'

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

/**
 * Like `useState<T>(fallback)`, but the value is remembered across unmount /
 * remount (and reload) under `key`, so an in-view switcher restores the user's
 * last segment instead of snapping back to the default.
 *
 * @param key      stable id for this switcher, e.g. `'train.futas.view'`
 * @param fallback the default segment when nothing has been remembered yet
 */
export function useStickyTab<T extends string>(key: string, fallback: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => (read(key) as T | null) ?? fallback)
  const set = useCallback(
    (next: T) => {
      try {
        sessionStorage.setItem(PREFIX + key, next)
      } catch {
        // sessionStorage unavailable (private mode / SSR) — fall back to
        // in-memory state only; the rule degrades gracefully.
      }
      setValue(next)
    },
    [key],
  )
  return [value, set]
}
