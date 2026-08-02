import { describe, expect, it } from 'vitest'
import type { MesoDay } from '@/data/types'
import {
  budgetGroup, budgetLevel, budgetOf, muscleBudgets, sessionCapWarnings, setStyle,
} from '@/features/train/logic/setBudget'

const ex = (muscle: string, workingSets: number, targetRIR: number) => ({
  id: `${muscle}-${workingSets}-${targetRIR}-${Math.random()}`, name: 'X', muscle,
  warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR, type: 'compound' as const,
})
const day = (dayKey: string, muscle: string, exercises: ReturnType<typeof ex>[]): MesoDay =>
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
