import type { AdminScreenUsageRow } from '@/data/admin/adminInsightsApi'
import { Sparkline } from '@/features/admin/components/Sparkline'
import { huInt } from '@/shared/lib/huNum'

// The "Képernyők" panel (bd mezo-o5cz): which screens people actually open, from the lean
// screen_event log. Rows come pre-sorted views-desc from the backend — this renders what it is
// given and never re-sorts, so the mock and real surfaces cannot disagree on order.
//
// The sparkline is the WINDOW TOTAL (all screens summed per day), not one per row: a 480x96 svg
// squeezed into a table cell is illegible, and the useful question at a glance is "is screen
// traffic going up or down", which the aggregate answers.

/** `2026-09-07T18:10:00Z` → `09.07.` — a compact "utoljára", never a full timestamp. */
function shortDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.`
}

export function ScreenUsageTable({ screens }: { screens: AdminScreenUsageRow[] }) {
  if (screens.length === 0) {
    // Not an error state: with the screen-telemetry switch off (the shipped default) the log is
    // legitimately empty and the endpoint answers a 200 with zero rows.
    return <div className="ad-mut">Még nincs képernyő-esemény.</div>
  }

  const dayCount = screens[0].days.length
  const totals = Array.from({ length: dayCount }, (_, i) =>
    screens.reduce((sum, s) => sum + (s.days[i]?.count ?? 0), 0),
  )

  return (
    <>
      <Sparkline points={totals} tone="lav" ariaLabel="Képernyő-megnyitások naponta" />
      <table className="ad-table">
        <thead>
          <tr>
            <th>Képernyő</th>
            <th className="num">Megnyitások</th>
            <th className="num">Userek</th>
            <th className="num">Utoljára</th>
          </tr>
        </thead>
        <tbody>
          {screens.map((row) => (
            <tr key={row.screen} className="norow">
              <td>{row.screen}</td>
              <td className="num">{huInt(row.views)}</td>
              <td className="num">{huInt(row.uniqueUsers)}</td>
              <td className="num">{shortDay(row.lastSeenAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
