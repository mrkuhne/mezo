import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import {
  GROUP_LANDMARKS, budgetGroup, budgetOf, daySessionBreakdown, leastLoadedDayFor, muscleBudgets,
  sessionCapWarnings, setStyle,
} from '@/features/train/logic/setBudget'

const ex = (muscle: string, workingSets: number, targetRIR: number) => ({
  id: `${muscle}-${workingSets}-${targetRIR}-${Math.random()}`, name: 'X', muscle,
  warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR, type: 'compound' as const,
})
const plyoEx = (muscle: string, workingSets: number) => ({ ...ex(muscle, workingSets, 0), type: 'plyo' as const })
const exemptEx = (muscle: string, workingSets: number) => ({ ...ex(muscle, workingSets, 0), countsTowardVolume: false })
const day = (dayKey: string, muscle: string, exercises: GymExercise[]): MesoDay =>
  ({ day: dayKey, type: 'Push', muscle, exerciseCount: exercises.length, exercises })

describe('setStyle', () => {
  it('classifies RIR 0 and 1 as failure, 2+ as volume', () => {
    expect(setStyle(0)).toBe('failure')
    expect(setStyle(1)).toBe('failure')
    expect(setStyle(2)).toBe('volume')
    expect(setStyle(5)).toBe('volume')
  })
})

// budgetOf/setStyle/FAILURE_WEEKLY_CAP/VOLUME_WEEKLY_CAP/GROUP_MEV are the ORIGINAL fatigue-cap
// model — muscleBudgets below no longer uses it (reframed against tier targets, mezo-3m5m), but
// programFit.ts and weekZone.ts still call these directly, so they stay and stay tested here.
describe('budgetOf', () => {
  it('caps: 12 failure sets or 20 volume sets exactly fill the fatigue budget', () => {
    expect(budgetOf(12, 0)).toBeCloseTo(1)
    expect(budgetOf(0, 20)).toBeCloseTo(1)
  })
  it('mixed: 8 failure + 6 volume = 0.9667', () => {
    expect(budgetOf(8, 6)).toBeCloseTo(8 / 12 + 6 / 20)
  })
})

describe('GROUP_LANDMARKS', () => {
  it('mirrors application.yml mezo.volume.baselines (mezo-3m5m)', () => {
    expect(GROUP_LANDMARKS).toEqual({
      chest: { mev: 8, mav: 14, mrv: 20 },
      back: { mev: 10, mav: 16, mrv: 22 },
      shoulder: { mev: 8, mav: 12, mrv: 18 },
      biceps: { mev: 6, mav: 10, mrv: 14 },
      triceps: { mev: 6, mav: 10, mrv: 14 },
      quad: { mev: 8, mav: 12, mrv: 18 },
      ham: { mev: 6, mav: 10, mrv: 14 },
      glute: { mev: 8, mav: 12, mrv: 18 },
      calf: { mev: 6, mav: 10, mrv: 16 },
    })
  })
})

describe('budgetGroup', () => {
  it('maps heads to coarse groups and keeps arms/legs split', () => {
    expect(budgetGroup('chest-upper')).toBe('chest')
    expect(budgetGroup('lats')).toBe('back')
    expect(budgetGroup('biceps-long')).toBe('biceps')
    expect(budgetGroup('triceps-medial')).toBe('triceps')
    expect(budgetGroup('quad')).toBe('quad')
    expect(budgetGroup('sport')).toBeNull()
    expect(budgetGroup('')).toBeNull()
  })
})

describe('muscleBudgets', () => {
  it('aggregates across days into groups with style split and level, against the Grow (default) tier target', () => {
    const days = [
      day('H', 'chest', [ex('chest-mid', 4, 0), ex('chest-upper', 4, 0)]),
      day('Cs', 'chest', [ex('chest-mid', 4, 2), ex('chest-lower', 4, 2)]),
      day('K', '', []), // rest day ignored
    ]
    const rows = muscleBudgets(days)
    expect(rows).toHaveLength(1)
    // chest landmark {mev:8, mav:14, mrv:20}; Grow (default, no priorities) -> target = mav 14.
    expect(rows[0]).toMatchObject({
      group: 'chest', label: 'Mell', failureSets: 8, volumeSets: 8, workingSets: 16,
      tier: 'grow', target: 14, level: 'over',
    })
    expect(rows[0].budget).toBeCloseTo(16 / 14)
  })
  it('skips off-day and sport rows entirely', () => {
    const days = [day('Sze', 'sport', [ex('sport', 6, 0)]), day('H', '', [])]
    expect(muscleBudgets(days)).toHaveLength(0)
  })
})

describe('muscleBudgets — tier target math (mezo-3m5m, GD5)', () => {
  const backWeek = (sets: number) => [day('H', 'back', [ex('back-wide', sets, 0)])]

  it('Grow (default, no priorities passed): target = MAV, near at 14/16', () => {
    const rows = muscleBudgets(backWeek(14))
    expect(rows[0]).toMatchObject({ tier: 'grow', target: 16, level: 'near' })
    expect(rows[0].budget).toBeCloseTo(0.875)
  })
  it('Emphasize: target = MRV, ok at 14/22', () => {
    const rows = muscleBudgets(backWeek(14), { back: 'emphasize' })
    expect(rows[0]).toMatchObject({ tier: 'emphasize', target: 22, level: 'ok' })
    expect(rows[0].budget).toBeCloseTo(14 / 22)
  })
  it('Maintain: target = MEV, over at 14/10', () => {
    const rows = muscleBudgets(backWeek(14), { back: 'maintain' })
    expect(rows[0]).toMatchObject({ tier: 'maintain', target: 10, level: 'over' })
    expect(rows[0].budget).toBeCloseTo(1.4)
  })
  // Fix round 2: Maintain's target IS the landmark mev, so 'near' (a ramp-approaching-ceiling
  // concept) is skipped for it — holding exactly at MEV is the spec's own canonical "good" state
  // (GD5: "Farizom · Maintain · 100%"), not an amber near-ceiling alarm.
  it('Maintain exactly at MEV is "ok", not "near" (spec GD5\'s canonical Farizom · Maintain · 100%)', () => {
    const rows = muscleBudgets([day('H', 'glute', [ex('glute', 8, 0)])], { glute: 'maintain' })
    expect(rows[0]).toMatchObject({ tier: 'maintain', target: 8, level: 'ok' })
    expect(rows[0].budget).toBeCloseTo(1)
  })
  it('Maintain one set below MEV is "under" — pins the boundary the fix must not blur', () => {
    const rows = muscleBudgets([day('H', 'glute', [ex('glute', 7, 0)])], { glute: 'maintain' })
    expect(rows[0]).toMatchObject({ tier: 'maintain', target: 8, level: 'under' })
  })
  it('a group with no landmark at all (traps) gets a null target/budget and level ok', () => {
    const rows = muscleBudgets([day('H', 'back', [ex('traps', 3, 0)])])
    expect(rows[0]).toMatchObject({ group: 'traps', target: null, budget: null, mev: null, level: 'ok' })
  })
  it('AD5: an explicit volumePerMuscle landmark wins over the static GROUP_LANDMARKS default', () => {
    const rows = muscleBudgets(backWeek(14), null, { back: { mev: 1, mav: 2, mrv: 3 } })
    expect(rows[0]).toMatchObject({ tier: 'grow', target: 2, level: 'over' }) // Grow -> mav 2, 14 > 2
  })
})

describe('sessionCapWarnings', () => {
  it('warns strictly above 8 working sets per group per day (cap tightened 11→8, mezo-d20.14)', () => {
    const ok = [day('H', 'shoulder', [ex('shoulder-side', 4, 2), ex('shoulder-front', 4, 2)])]  // 8
    const bad = [day('H', 'shoulder', [ex('shoulder-side', 4, 2), ex('shoulder-front', 5, 2)])] // 9
    expect(sessionCapWarnings(ok)).toHaveLength(0)
    expect(sessionCapWarnings(bad)).toEqual([{ day: 'H', group: 'shoulder', label: 'Váll', sets: 9 }])
  })
})

describe('plyo exclusion (mezo-0znc)', () => {
  it('plyo sets leave budget math but are reported as exemptSets', () => {
    const days = [day('H', 'quad', [ex('quad', 9, 0), plyoEx('quad', 10)])]
    const rows = muscleBudgets(days)
    expect(rows[0]).toMatchObject({ group: 'quad', workingSets: 9, exemptSets: 10 })
    expect(rows[0].budget).toBeCloseTo(9 / 12)
    expect(rows[0].level).toBe('ok')
  })
  it('session cap ignores plyo sets', () => {
    // 6 real sets stay under the 8 cap; the 10 plyo sets would blow well past it if
    // wrongly counted (6+10=16 > 8), so this only passes if plyo is truly excluded.
    const days = [day('H', 'quad', [ex('quad', 6, 0), plyoEx('quad', 10)])]
    expect(sessionCapWarnings(days)).toHaveLength(0)
  })
  it('plyo-only group emits no budget row', () => {
    const days = [day('H', 'quad', [plyoEx('quad', 6)])]
    expect(muscleBudgets(days)).toHaveLength(0)
  })

  it('an exempt exercise is reported separately and never enters the budget', () => {
    const days = [{
      day: 'Hét', type: 'Pull', muscle: 'back', exerciseCount: 2,
      exercises: [
        { id: 'a', name: 'Pull-Up', muscle: 'back-wide', warmupSets: 2, workingSets: 3,
          repMin: 6, repMax: 8, targetRIR: 0, type: 'compound' as const },
        { id: 'b', name: '45° Back Extension', muscle: 'back-lower', warmupSets: 0, workingSets: 2,
          repMin: 12, repMax: 15, targetRIR: 2, type: 'isolation' as const, countsTowardVolume: false },
      ],
    }]
    const back = muscleBudgets(days)[0]
    expect(back.workingSets).toBe(3)
    expect(back.exemptSets).toBe(2)
  })

  it('a plyo exercise with no explicit flag still stays out of the budget', () => {
    const days = [{
      day: 'Kedd', type: 'Legs', muscle: 'quad', exerciseCount: 1,
      exercises: [
        { id: 'c', name: 'Box Jump', muscle: 'quad', warmupSets: 0, workingSets: 2,
          repMin: 6, repMax: 10, targetRIR: 0, type: 'plyo' as const },
      ],
    }]
    expect(muscleBudgets(days)).toHaveLength(0)
  })
})

describe('daySessionBreakdown', () => {
  it('aggregates the day per group with over flag and exempt split', () => {
    const d = day('H', 'shoulder', [ex('shoulder-side', 6, 0), ex('shoulder-front', 6, 0), plyoEx('quad', 4)])
    const rows = daySessionBreakdown(d)
    expect(rows[0]).toMatchObject({ group: 'shoulder', sets: 12, over: true })
    expect(rows[1]).toMatchObject({ group: 'quad', sets: 0, exemptSets: 4, over: false })
  })
})

describe('leastLoadedDayFor', () => {
  it('names the other training day with the fewest sets for the group', () => {
    const days = [
      day('H', 'shoulder', [ex('shoulder-side', 12, 0)]),
      day('Sze', 'shoulder', [ex('shoulder-front', 4, 0)]),
      day('K', '', []),
    ]
    expect(leastLoadedDayFor(days, 'shoulder', 'H')).toBe('Sze')
    expect(leastLoadedDayFor([days[0], days[2]], 'shoulder', 'H')).toBeNull()
  })

  it('treats a day dominated by exempt (countsTowardVolume: false) work as lightly loaded (mezo-gbo7)', () => {
    // 'Sze' carries 10 exempt sets on top of 2 real ones — under the old plyo-only guard those
    // 10 sets are ordinary 'compound' type, so they'd count as load and make 'Sze' look heavier
    // than 'Cs' (5 real sets). If the guard reverts to `ex.type === 'plyo'`, this flips to 'Cs'.
    const days = [
      day('H', 'shoulder', [ex('shoulder-side', 20, 0)]),
      day('Sze', 'shoulder', [ex('shoulder-front', 2, 0), exemptEx('shoulder-front', 10)]),
      day('Cs', 'shoulder', [ex('shoulder-front', 5, 0)]),
    ]
    expect(leastLoadedDayFor(days, 'shoulder', 'H')).toBe('Sze')
  })
})

describe('optimal zone (mezo-oyhy.1; recomputed against landmark MEV/MAV mezo-3m5m)', () => {
  it('flags under strictly below the group landmark MEV', () => {
    // biceps landmark mev=6 (was GROUP_MEV.biceps=8 pre-mezo-3m5m).
    const under = muscleBudgets([day('H', 'arms', [ex('biceps-long', 5, 0)])])
    const atMev = muscleBudgets([day('H', 'arms', [ex('biceps-long', 6, 0)])])
    expect(under[0].level).toBe('under')
    expect(under[0].setsToZone).toBe(1)
    expect(atMev[0].level).toBe('ok')
    expect(atMev[0].setsToZone).toBe(0)
  })

  it('zoneStart is mev/target — a structural ratio, invariant to the style mix or set count', () => {
    // chest landmark {mev:8, mav:14, mrv:20}; Grow (default) target = mav 14 -> zoneStart 8/14
    // regardless of whether the sets are pure volume, pure failure, or a mix.
    const volume = muscleBudgets([day('H', 'chest', [ex('chest-mid', 5, 2)])])
    expect(volume[0].zoneStart).toBeCloseTo(8 / 14)
    const failure = muscleBudgets([day('H', 'chest', [ex('chest-mid', 5, 0)])])
    expect(failure[0].zoneStart).toBeCloseTo(8 / 14)
    const mixed = muscleBudgets([day('H', 'chest', [ex('chest-mid', 6, 0), ex('chest-upper', 4, 2)])])
    expect(mixed[0].budget).toBeCloseTo(10 / 14) // workingSets 10 / target 14 — style mix no longer matters
    expect(mixed[0].zoneStart).toBeCloseTo(8 / 14)
  })

  it('compares MEV against non-plyo sets only', () => {
    const rows = muscleBudgets([day('H', 'quad', [ex('quad', 3, 0), plyoEx('quad', 10)])])
    expect(rows[0].level).toBe('under') // 3 < quad landmark MEV 8 — plyo does not rescue it
  })

  it('traps and core have no landmark and never go under', () => {
    const rows = muscleBudgets([day('H', 'back', [ex('traps', 1, 0)])])
    expect(rows[0]).toMatchObject({ level: 'ok', target: null, budget: null, mev: null, zoneStart: null, setsToZone: 0 })
  })

  it('suggests the least-loaded training day for an under group', () => {
    const days = [
      day('H', 'arms', [ex('biceps-long', 3, 0), ex('chest-mid', 6, 0)]),
      day('Csü', 'chest', [ex('chest-mid', 2, 0)]),
    ]
    const bi = muscleBudgets(days).find((r) => r.group === 'biceps')!
    expect(bi.level).toBe('under')
    expect(bi.suggestedDay).toBe('Csü')
    const inZone = muscleBudgets(days).find((r) => r.group === 'chest')!
    expect(inZone.suggestedDay).toBeNull()
  })
})
