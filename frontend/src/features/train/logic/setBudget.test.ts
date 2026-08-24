import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import {
  budgetGroup, budgetLevel, budgetOf, daySessionBreakdown, leastLoadedDayFor, muscleBudgets,
  sessionCapWarnings, setStyle,
} from '@/features/train/logic/setBudget'

const ex = (muscle: string, workingSets: number, targetRIR: number) => ({
  id: `${muscle}-${workingSets}-${targetRIR}-${Math.random()}`, name: 'X', muscle,
  warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR, type: 'compound' as const,
})
const plyoEx = (muscle: string, workingSets: number) => ({ ...ex(muscle, workingSets, 0), type: 'plyo' as const })
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

describe('budgetOf + budgetLevel', () => {
  it('caps: 12 failure sets or 20 volume sets exactly fill the budget', () => {
    expect(budgetOf(12, 0)).toBeCloseTo(1)
    expect(budgetOf(0, 20)).toBeCloseTo(1)
    expect(budgetLevel(1)).toBe('near') // 100% is still allowed — over only past it
    expect(budgetLevel(1.01)).toBe('over')
    expect(budgetLevel(0.84)).toBe('ok')
    expect(budgetLevel(0.85)).toBe('near')
  })
  it('mixed: 8 failure + 6 volume = 0.9667; +2 volume tips over', () => {
    expect(budgetOf(8, 6)).toBeCloseTo(8 / 12 + 6 / 20)
    expect(budgetLevel(budgetOf(8, 6))).toBe('near')
    expect(budgetLevel(budgetOf(8, 8))).toBe('over')
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
  it('aggregates across days into groups with style split and level', () => {
    const days = [
      day('H', 'chest', [ex('chest-mid', 4, 0), ex('chest-upper', 4, 0)]),
      day('Cs', 'chest', [ex('chest-mid', 4, 2), ex('chest-lower', 4, 2)]),
      day('K', '', []), // rest day ignored
    ]
    const rows = muscleBudgets(days)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      group: 'chest', label: 'Mell', failureSets: 8, volumeSets: 8, workingSets: 16, level: 'over',
    })
    expect(rows[0].budget).toBeCloseTo(8 / 12 + 8 / 20)
  })
  it('skips off-day and sport rows entirely', () => {
    const days = [day('Sze', 'sport', [ex('sport', 6, 0)]), day('H', '', [])]
    expect(muscleBudgets(days)).toHaveLength(0)
  })
})

describe('sessionCapWarnings', () => {
  it('warns strictly above 11 working sets per group per day', () => {
    const ok = [day('H', 'shoulder', [ex('shoulder-side', 6, 2), ex('shoulder-front', 5, 2)])]  // 11
    const bad = [day('H', 'shoulder', [ex('shoulder-side', 6, 2), ex('shoulder-front', 6, 2)])] // 12
    expect(sessionCapWarnings(ok)).toHaveLength(0)
    expect(sessionCapWarnings(bad)).toEqual([{ day: 'H', group: 'shoulder', label: 'Váll', sets: 12 }])
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
    const days = [day('H', 'quad', [ex('quad', 9, 0), plyoEx('quad', 10)])]
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
})

describe('optimal zone (mezo-oyhy.1)', () => {
  it('flags under strictly below the group MEV', () => {
    const under = muscleBudgets([day('H', 'arms', [ex('biceps-long', 7, 0)])])
    const atMev = muscleBudgets([day('H', 'arms', [ex('biceps-long', 8, 0)])])
    expect(under[0].level).toBe('under')
    expect(under[0].setsToZone).toBe(1)
    expect(atMev[0].level).toBe('ok')
    expect(atMev[0].setsToZone).toBe(0)
  })

  it('projects zoneStart onto the budget scale with the group style mix', () => {
    const volume = muscleBudgets([day('H', 'chest', [ex('chest-mid', 5, 2)])])
    expect(volume[0].zoneStart).toBeCloseTo(4 / 20) // pure volume: MEV 4 of cap 20
    const failure = muscleBudgets([day('H', 'chest', [ex('chest-mid', 5, 0)])])
    expect(failure[0].zoneStart).toBeCloseTo(4 / 12) // pure failure: MEV 4 of cap 12
    const mixed = muscleBudgets([day('H', 'chest', [ex('chest-mid', 6, 0), ex('chest-upper', 4, 2)])])
    expect(mixed[0].budget).toBeCloseTo(0.7) // 6/12 + 4/20
    expect(mixed[0].zoneStart).toBeCloseTo(0.28) // 0.7 × 4/10
  })

  it('compares MEV against non-plyo sets only', () => {
    const rows = muscleBudgets([day('H', 'quad', [ex('quad', 3, 0), plyoEx('quad', 10)])])
    expect(rows[0].level).toBe('under') // 3 < quad MEV 4 — plyo does not rescue it
  })

  it('traps and core have no lower bound and never go under', () => {
    const rows = muscleBudgets([day('H', 'back', [ex('traps', 1, 0)])])
    expect(rows[0]).toMatchObject({ level: 'ok', mev: null, zoneStart: null, setsToZone: 0 })
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
