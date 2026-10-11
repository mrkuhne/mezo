// ============================================================
// Mezo · MesoTubes — the weeks of a plan as vessels (Folyadék F3, mezo-n4wf5.3; prototype
// vilagos/edzes.js `mesoTubes`). The past weeks are full, the current one is ringed, the
// coming ones are a dashed waterline in an empty tube, the pihenőhét is hatched and the
// peak week carries a ▲.
//
// Two faces, one component:
//   · with `values` — the per-week set counts (useMesocycleVolumeArc → muscles[].weeks[].planned,
//     summed for the plan, or one muscle's own series); `nowDone` splits the current week into
//     „megvan / terv" (the week's completed instances);
//   · without — before the first workout only the plan's own landmark curve (`phaseCurve`) is
//     known, so the tubes stand at the phase heights and carry NO numbers.
// Shared by the Terv landing, the plan's own page (first-workout and planned faces) and the
// muscle page.
// ============================================================
import type { MesoPhase } from '@/data/types'
import { Tubes, type VialItem } from '@/shared/ui/folyadek'

/** The phase in the owner's words — never the engine's MEV / MAV / MRV / Deload. */
export const PHASE_WORD: Record<MesoPhase, string> = { MEV: 'Emelkedés', MAV: 'Emelkedés', MRV: 'Csúcshét', Deload: 'Pihenőhét' }

/** The plain face's tube heights: the plan's landmark curve, the one per-week quantity a plan
 *  carries before its first session. */
const PHASE_HEIGHT: Record<MesoPhase, number> = { MEV: 34, MAV: 66, MRV: 100, Deload: 26 }

/** The plan's per-week set totals off the volume arc (every muscle's planned sets, week by week). */
export function arcWeekTotals(arc: { weeks: number; muscles: { weeks: { week: number; planned: number }[] }[] }): number[] {
  return Array.from({ length: arc.weeks }, (_, i) =>
    arc.muscles.reduce((sum, m) => sum + (m.weeks.find((w) => w.week === i + 1)?.planned ?? 0), 0))
}

export function MesoTubes({ curve, weeks, values, now, nowDone, height = 104, max, color, ariaLabel }: {
  /** One phase per week — sets the hatch (pihenőhét) and the ▲ (peak), and the plain heights. */
  curve: MesoPhase[]
  /** How many weeks the plan has (default: the curve's length) — a short curve leaves the rest plain. */
  weeks?: number
  /** Set counts per week; absent = the plain face (phase heights, no numbers). */
  values?: number[] | null
  /** The current week (1-based); 0 = not started, every tube is still to come. */
  now: number
  /** Sets already done in the current week — the tube then reads „done / planned". */
  nowDone?: number | null
  height?: number
  max?: number
  color?: string
  ariaLabel?: string
}) {
  const plain = values == null
  const n = plain ? (weeks ?? curve.length) : values.length
  const mx = max ?? (plain ? 1 : Math.max(...values, 1))
  const tight = n > 6
  const items: VialItem[] = Array.from({ length: n }, (_, i) => {
    const week = i + 1
    const past = week < now, cur = week === now
    const phase: MesoPhase | undefined = curve[i]
    const deload = phase === 'Deload', peak = phase === 'MRV'
    const sets = plain ? 0 : values[i]
    const level = plain ? (phase ? PHASE_HEIGHT[phase] : 34) * 0.94 : (sets / mx) * 94
    const split = cur && !plain && nowDone != null
    return {
      label: tight ? `${week}.` : `${week}. hét`,
      value: plain ? undefined : split ? <>{nowDone}<u>/{sets}</u></> : sets,
      note: cur ? 'most' : deload ? 'pihenő' : peak ? 'csúcs' : undefined,
      pct: past ? level : cur ? (split ? ((nowDone ?? 0) / mx) * 94 : level) : 0,
      wl: past ? undefined : level,
      now: cur, ghost: !past && !cur, hatch: deload,
      color: color ?? 'var(--dom)',
      mark: deload ? '↓' : peak ? '▲' : undefined,
    }
  })
  return <Tubes items={items} height={height} size="wk" gap={tight ? 4 : 6} aria-label={ariaLabel} />
}
