// ============================================================
// Mezo · Karakter — feedDayLabel (mezo-1gim.13, Task 4)
// Source: docs/design_2.0/prototypes/src/karakter-body.html FEED's day-group header
// (`grp.day`). The prototype hardcodes its day strings; the real feed only carries an ISO
// timestamp per item, so the FE derives the HU day label itself: "MA" for today, "TEGNAP"
// for yesterday, else a short localized date. `now` is injectable so the day-boundary math
// stays deterministic in tests.
// ============================================================
export function feedDayLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(at)) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return 'MA'
  if (diffDays === 1) return 'TEGNAP'
  return at.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
}
