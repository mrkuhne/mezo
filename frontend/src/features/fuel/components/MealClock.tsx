// ============================================================
// Mezo · MealClock — a blokk kis órája (mezo-6g52f, owner 2026-09-26: „A · beszédes óra").
// Folyadék F5 (mezo-n4wf5.5): the face is the Fuel-shared `Dial` (the ONE allowed circle: a real clock) — the suggested
// window as an arc, the log (or „now" while the window is open) as a drop: white inside the window, amber outside, never
// the error colour. The button opens the clock sheet (`MealClockBox`). Area A's blocks draw `Dial` themselves; this
// component stays for the callers that want the button with its spoken label.
// ============================================================
import { useM } from '@/shared/i18n'
import { toMin } from '@/data/fuel/fuelConfig'
import { hitOf, hitLabel } from '@/features/fuel/logic/mealWindow'
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'
import { judgedWindow } from '@/features/fuel/components/mealClockWindow'
import { Dial } from '@/features/fuel/components/folyadek'

export function MealClock({ tile, row, nowHHmm, onOpen }: {
  tile: WindowTileVM; row: DoneMealRow | null
  /** Null a múltbéli napokon (mezo-6g52f R4) — nincs „most", nincs most-pötty. */
  nowHHmm: string | null
  onOpen: () => void
}) {
  const M = useM()
  const A = M.fuelEtkezes.clock.aria
  const w = judgedWindow(tile, row)
  const open = !row && w != null && nowHHmm != null && toMin(nowHHmm) >= toMin(w.from) && toMin(nowHHmm) <= toMin(w.to)
  const hit = row && w ? hitOf(w.from, w.to, row.time) : null
  const aria = row
    ? (hit ? A.loggedHit(tile.label, row.time, hitLabel(hit)) : A.logged(tile.label, row.time))
    : w ? A.window(tile.label, w.from, w.to) : A.plain(tile.label)
  return (
    <button type="button" className={`fe-mclock${open ? ' is-open' : ''}`} onClick={onOpen} aria-label={aria}>
      <Dial from={w?.from} to={w?.to} at={row ? row.time : open ? nowHHmm : null} size={44} />
    </button>
  )
}
