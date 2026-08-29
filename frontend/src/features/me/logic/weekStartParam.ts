// ============================================================
// Mezo · `?start=` → an ISO Monday (mezo-d20.6.10)
// The Heti detail pages inherit the browsed week from the hub through the query
// string, so every one of them needs WeekPage's `resolveStart` guard: an absent,
// malformed or non-Monday value always falls back to the CURRENT week, never a
// stale or invalid one (the backend 400s on a non-Monday `{start}`).
// Extracted from WeekPage so the detail pages share ONE implementation.
// ============================================================
import { mondayIso } from '@/data/fuel/fuelWeekHooks'

/** `?start=` -> a real ISO Monday, or the current week's when absent/invalid/not-a-Monday. */
export function resolveWeekStart(raw: string | null | undefined): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && dt.getDay() === 1) return raw
  }
  return mondayIso()
}

/** The hub link that carries the browsed week back with it. */
export function weekHubHref(startIso: string): string {
  return `/me/week?start=${startIso}`
}
