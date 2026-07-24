import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { muscleRegionGroups, muscleWeekFromMeso } from '@/features/train/logic/muscleWeek'

let n = 0
const ex = (muscle: string, workingSets: number, repMin = 8, repMax = 12): GymExercise => ({
  id: `ex-${n++}`, name: `${muscle}-${n}`, muscle, warmupSets: 1, workingSets,
  repMin, repMax, targetRIR: 2, type: 'compound',
})
const day = (d: string, exercises: GymExercise[]): MesoDay => ({
  day: d, type: 'Day', muscle: exercises[0]?.muscle ?? '', exerciseCount: exercises.length, exercises,
})

describe('muscleWeekFromMeso', () => {
  it('aggregates sets, weekly rep range, exercise count and frequency per muscle', () => {
    const rows = muscleWeekFromMeso([
      day('Hét', [ex('chest', 3, 8, 12), ex('chest', 3, 10, 15), ex('lats', 4)]),
      day('Csü', [ex('chest', 4, 8, 12)]),
    ])
    const chest = rows.find((r) => r.muscle === 'chest')!
    expect(chest.workingSets).toBe(10)
    expect(chest.repMinTotal).toBe(3 * 8 + 3 * 10 + 4 * 8) // 86
    expect(chest.repMaxTotal).toBe(3 * 12 + 3 * 15 + 4 * 12) // 129
    expect(chest.exerciseCount).toBe(3)
    expect(chest.gymFrequency).toBe(2)
    expect(rows.find((r) => r.muscle === 'lats')!.gymFrequency).toBe(1)
  })
  it('excludes rest/sport rows and sorts by sets desc', () => {
    const rows = muscleWeekFromMeso([
      day('Hét', [ex('quad', 6), ex('chest', 3)]),
      day('Kedd', [ex('sport', 5), ex('', 2)]),
    ])
    expect(rows.map((r) => r.muscle)).toEqual(['quad', 'chest'])
  })
})

describe('muscleRegionGroups', () => {
  it('groups by region in fixed order, omitting empty regions', () => {
    const rows = muscleWeekFromMeso([day('Hét', [ex('core', 2), ex('chest', 3), ex('quad', 4), ex('ham', 2)])])
    const groups = muscleRegionGroups(rows)
    expect(groups.map((g) => g.label)).toEqual(['Mell', 'Láb', 'Core'])
    expect(groups[1].rows.map((r) => r.muscle)).toEqual(['quad', 'ham'])
  })
})
