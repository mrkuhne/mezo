// ============================================================
// Mezo · mesoBands — meso pages v2 (Task 1). Pure, no React. Derives the run-time
// current→ceiling bands, the phase chip, week dots, the decider sentence and the
// next-rollover chips shown on the active-meso page. Reuses BUDGET_GROUP_LABELS
// (setBudget.ts), ceilingSets (mesoPlan.ts) and tierOf (musclePriorities.ts) so the
// group labels/ceiling math/tier defaulting stay in one place.
// ============================================================
import type { Mesocycle, MuscleTier, VolumeChange } from '@/data/types'
import { BUDGET_GROUP_LABELS } from '@/features/train/logic/setBudget'
import { ceilingSets } from '@/features/train/logic/mesoPlan'
import { tierOf } from '@/features/train/logic/musclePriorities'

export interface RunBand {
  group: string
  label: string
  tier: MuscleTier
  current: number
  ceiling: number
  mev: number
  mav: number
  mrv: number
  pct: number
  step: 'up' | 'hold' | 'cap'
}

/** current → ceiling per muscle group, sorted by ceiling descending. */
export function runBands(meso: Mesocycle): RunBand[] {
  const profiles = meso.volumePerMuscle ?? {}
  const rows: RunBand[] = Object.entries(profiles).map(([group, profile]) => {
    const tier = tierOf(meso.musclePriorities, group)
    const ceiling = ceilingSets(tier, profile)
    const step: RunBand['step'] = tier === 'maintain' ? 'hold' : profile.current >= ceiling ? 'cap' : 'up'
    return {
      group,
      label: BUDGET_GROUP_LABELS[group] ?? group,
      tier,
      current: profile.current,
      ceiling,
      mev: profile.mev,
      mav: profile.mav,
      mrv: profile.mrv,
      pct: ceiling > 0 ? profile.current / ceiling : 0,
      step,
    }
  })
  return rows.sort((a, b) => b.ceiling - a.ceiling)
}

export type Phase = 'Rámpa' | 'Csúcs' | 'Deload'

/** phaseCurve[currentWeek-1]: 'Deload' → Deload, 'MRV' → Csúcs, else Rámpa. */
export function phaseChip(meso: Mesocycle): Phase {
  const phase = meso.phaseCurve[meso.currentWeek - 1]
  if (phase === 'Deload') return 'Deload'
  if (phase === 'MRV') return 'Csúcs'
  return 'Rámpa'
}

export interface WeekDot {
  week: number
  state: 'done' | 'now' | 'future'
  deload: boolean
}

export function weekDots(meso: Mesocycle): WeekDot[] {
  return Array.from({ length: meso.weeks }, (_, i) => {
    const week = i + 1
    const state: WeekDot['state'] = week < meso.currentWeek ? 'done' : week === meso.currentWeek ? 'now' : 'future'
    return { week, state, deload: meso.phaseCurve[i] === 'Deload' }
  })
}

// Real vocabulary for VolumeChange.reason, from the backend (source of truth for the
// live API — the FE mock fixture in data/train/train.ts still carries older, richer
// narrative reason strings for its three seed changes; those fall through to the
// generic `${label}: ${change}.` copy below rather than one of the four templates):
//   backend/.../service/VolumeDecider.java          — Lever: START | RAMP | HOLD | DELOAD
//   backend/.../service/VolumeProgressionService.java#reasonFor(Lever):
//     START  → "kezdő hét (MEV)"
//     RAMP   → "cél teljesítve, nincs grind"
//     HOLD   → "tartás"           (covers both "grind kept us at the ceiling" and
//                                  "didn't hit last week's target" — the lever string
//                                  itself doesn't disambiguate; HOLD always reads as the
//                                  grind/hold copy per the brief)
//     DELOAD → "deload"
export function deciderSentence(meso: Mesocycle): string | null {
  const change: VolumeChange | undefined = meso.volumeRecompute?.changes[0]
  if (!change) return null
  const label = BUDGET_GROUP_LABELS[change.muscle] ?? change.muscle
  const current = meso.volumePerMuscle?.[change.muscle]?.current
  switch (change.reason) {
    case 'tartás':
      return current === undefined
        ? `A ${label} a múlt héten grindelt (RIR-rés), ezért most tartjuk a szettszámot — a rámpa folytatódik, amint visszaáll a tempó.`
        : `A ${label} a múlt héten grindelt (RIR-rés), ezért most tartjuk a ${current} szettet — a rámpa folytatódik, amint visszaáll a tempó.`
    case 'cél teljesítve, nincs grind':
      return `Produktív hét: a ${label} +2 szettet kap.`
    case 'deload':
      return `Deload hét: a ${label} fél volumenen pihen.`
    default:
      return `${label}: ${change.change}.`
  }
}

export function nextRolloverChips(meso: Mesocycle): { label: string; text: string; tone: 'sage' | 'mut' }[] {
  return runBands(meso).map((row) =>
    row.step === 'up'
      ? { label: row.label, text: `${row.label} +2`, tone: 'sage' as const }
      : { label: row.label, text: `${row.label} tart`, tone: 'mut' as const },
  )
}
