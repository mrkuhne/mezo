// ============================================================
// Mezo · dayTiles — a Program-lépés nap-mozaikjának és a nap-oldalnak a közös
// leszármaztatása (mezo-d20.14): egy MesoDay → csempe-adat (szett, ~perc, izom-
// sávok, típus-árnyalat). Egy helyen, mert a mozaik és a nap-oldal ugyanazt a
// napot mutatja — két külön számolás előbb-utóbb elcsúszik.
// ============================================================
import type { MesoDay } from '@/data/types'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { dayTone, type DayTone } from '@/features/train/logic/mesoLoad'
import { daySessionBreakdown } from '@/features/train/logic/setBudget'
import type { DayTileMuscle } from '@/features/train/wizard/DayTile'

export { dayTone }
export type { DayTone }

export interface DayTileData {
  sets: number
  /** the prototype's session-length shorthand: 4.4 minutes per working set */
  minutes: number
  muscles: DayTileMuscle[]
  tone: DayTone
}

export function dayTileData(day: MesoDay): DayTileData {
  const rows = daySessionBreakdown(day)
  const sets = day.exercises.reduce((a, e) => a + e.workingSets, 0)
  return {
    sets,
    minutes: Math.round(sets * 4.4),
    muscles: rows.map((r) => ({
      label: r.label,
      sets: r.sets,
      color: muscleColor(r.colorMuscle).deep,
      over: r.over,
    })),
    tone: dayTone(day.type),
  }
}
