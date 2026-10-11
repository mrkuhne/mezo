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

/** One muscle of a day in the planner's per-day summary. */
export interface DayTileMuscle {
  label: string
  sets: number
  /** the muscle family's deep token (a CSS var reference) */
  color: string
  /** over the per-session muscle cap — the model will reshuffle it */
  over: boolean
  /**
   * The group's representative catalog token ('back-mid', 'quad', …) — the SAME
   * `colorMuscle` the colour is derived from. U5's day card draws the anatomy
   * (MuscleChip + BodyMap) from it, so the chip and the bar can never disagree
   * about which muscle a row is (mezo-me75u.5).
   */
  token: string
}

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
      token: r.colorMuscle,
    })),
    tone: dayTone(day.type),
  }
}
