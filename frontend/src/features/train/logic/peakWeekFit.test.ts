import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { peakWeekFit } from '@/features/train/logic/peakWeekFit'

const ex = (id: string, muscle: string, over: Partial<GymExercise> = {}): GymExercise => ({
  id, name: over.name ?? id, muscle, warmupSets: 1, workingSets: 3,
  repMin: 8, repMax: 10, targetRIR: 2, type: 'compound', ...over,
})
const day = (dayKey: string, muscle: string, exercises: GymExercise[]): MesoDay =>
  ({ day: dayKey, type: 'Push', muscle, exerciseCount: exercises.length, exercises })

describe('peakWeekFit (mezo-3m5m, GD6)', () => {
  // Deterministic peak-week projection fixture. Group 'back' (back-mid/back-wide/lats all map
  // to it), tier Emphasize -> target = volumePerMuscle.back.mrv = 40 (explicit override so the
  // math below doesn't depend on the GROUP_LANDMARKS constant).
  //
  // byGroup collection order (iteration order: day-by-day, exercise-by-exercise) = [A1, A2, B1].
  // exerciseCount = 3, remaining = 40 - 3 = 37, templateSum = 3 + 2 + 1 = 6.
  //   A1: exact = 37*3/6 = 18.5   -> floor 18, frac .5
  //   A2: exact = 37*2/6 = 12.333 -> floor 12, frac .333
  //   B1: exact = 37*1/6 = 6.1667 -> floor 6,  frac .1667
  // distributedExtra = 18+12+6 = 36, leftover = 37-36 = 1 -> goes to the biggest fraction (A1).
  // extra: A1 = 19, A2 = 12, B1 = 6  =>  effective sets: A1 = 20, A2 = 13, B1 = 7.
  //
  // Day 'Szo' (A1 E=20 warmup=2, A2 E=13 warmup=1; compound repMin 8/repMax 10, avgReps 9):
  //   A1: exec 20*9*3.5=630, rest 19*150=2850, warmup 2*65=130, transition 90 -> 3700 s
  //   A2: exec 13*9*3.5=409.5, rest 12*150=1800, warmup 1*65=65, transition 90 -> 2364.5 s
  //   total 6064.5 s -> 101.075 min (round -> 101) + 8 warmup block = 109 min -> OVER (>90)
  // Day 'Sze' (B1 E=7 warmup=1):
  //   exec 7*9*3.5=220.5, rest 6*150=900, warmup 1*65=65, transition 90 -> 1275.5 s
  //   -> 21.258 min (round -> 21) + 8 = 29 min -> UNDER (<45)
  it('projects a 2-day back-only week onto its Emphasize target and flags both out-of-band days', () => {
    const a1 = ex('a1', 'back-mid', { workingSets: 3, warmupSets: 2 })
    const a2 = ex('a2', 'back-wide', { workingSets: 2, warmupSets: 1 })
    const b1 = ex('b1', 'lats', { workingSets: 1, warmupSets: 1 })
    const days = [day('Szo', 'back', [a1, a2]), day('Sze', 'back', [b1])]

    const fits = peakWeekFit(days, { back: 'emphasize' }, { back: { mev: 5, mav: 20, mrv: 40 } })

    expect(fits).toEqual([
      { day: 'Szo', minutes: 109, direction: 'over' },
      { day: 'Sze', minutes: 29, direction: 'under' },
    ])
  })

  // All-Grow (default, no priorities passed) small plan: chest (mav 14) and quad (mav 12), one
  // exercise per group per day, 2 days -> count 2 each. remaining chest = 14-2=12, templateSum
  // 3+3=6, exact 6.0 each (no leftover) -> effective 7 each. remaining quad = 12-2=10,
  // templateSum 6, exact 5.0 each -> effective 6 each. Both days are identical:
  //   chest E=7 warmup=1: exec 7*9*3.5=220.5, rest 6*150=900, warmup 65, transition 90 -> 1275.5 s
  //   quad  E=6 warmup=1: exec 6*9*3.5=189,   rest 5*150=750, warmup 65, transition 90 -> 1094 s
  //   day total 2369.5 s -> 39.49 min (round -> 39) + 8 = 47 min -> inside [45,90], not flagged.
  it('a modest all-Grow (default) 2-day plan projects to stay inside the band -> []', () => {
    const chest = () => ex(`chest-${Math.random()}`, 'chest-mid', { workingSets: 3, warmupSets: 1 })
    const quad = () => ex(`quad-${Math.random()}`, 'quad', { workingSets: 3, warmupSets: 1 })
    const days = [day('Hét', 'chest', [chest(), quad()]), day('Csü', 'chest', [chest(), quad()])]

    expect(peakWeekFit(days)).toEqual([])
  })

  // Non-counted exercises keep their template sets: a plyo exercise (countsForVolume defaults to
  // false for type 'plyo') and an explicit countsTowardVolume:false exercise are both excluded
  // from the group's exerciseCount/templateSum and are NOT rewritten in the output — only the
  // lone counted quad exercise (Q1) absorbs the whole Emphasize projection.
  //
  // Group 'quad', tier Emphasize, target = volumePerMuscle.quad.mrv = 26. Only Q1 counts
  // (Q3 is plyo, Q4 is countsTowardVolume:false) -> exerciseCount=1, remaining=26-1=25,
  // templateSum=3 (Q1's own workingSets) -> exact=25*3/3=25.0 -> effective = 1+25 = 26.
  //   Q1 (E=26, warmup=1, compound): exec 26*9*3.5=819, rest 25*150=3750, warmup 65, transition 90
  //     -> 4724 s
  //   Q3 (plyo, UNCHANGED template: workingSets=4, warmupSets=0, repMin=5/repMax=5, avgReps=5,
  //       plyo repSec=2, plyo rest=90): exec 4*5*2=40, rest 3*90=270, warmup 0, transition 90
  //     -> 400 s
  //   Q4 (compound, countsTowardVolume:false, UNCHANGED template: workingSets=2, warmupSets=1,
  //       repMin=10/repMax=12, avgReps=11): exec 2*11*3.5=77, rest 1*150=150, warmup 65,
  //       transition 90 -> 382 s
  //   day total = 4724 + 400 + 382 = 5506 s -> 91.767 min (round -> 92) + 8 = 100 min -> OVER
  it('plyo and countsTowardVolume:false exercises keep their template sets in the projection', () => {
    const q1 = ex('q1', 'quad', { workingSets: 3, warmupSets: 1 })
    const q3 = ex('q3', 'quad', { workingSets: 4, warmupSets: 0, repMin: 5, repMax: 5, type: 'plyo' })
    const q4 = ex('q4', 'quad', {
      workingSets: 2, warmupSets: 1, repMin: 10, repMax: 12, countsTowardVolume: false,
    })
    const days = [day('Hét', 'quad', [q1, q3, q4])]

    const fits = peakWeekFit(days, { quad: 'emphasize' }, { quad: { mev: 5, mav: 12, mrv: 26 } })

    expect(fits).toEqual([{ day: 'Hét', minutes: 100, direction: 'over' }])
  })

  it('an off day and an empty-exercise day never get flagged (no 0-minute "under" noise)', () => {
    const rest = day('K', '', [])
    expect(peakWeekFit([rest])).toEqual([])
  })
})
