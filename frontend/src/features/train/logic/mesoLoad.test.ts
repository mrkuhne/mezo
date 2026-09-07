import { describe, expect, test } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { adjacentDayConflicts, dayMuscleLoad, weekMuscleLoad } from '@/features/train/logic/mesoLoad'

function ex(id: string, name: string, muscle: string, workingSets: number, extra: Partial<GymExercise> = {}): GymExercise {
  return {
    id, name, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR: 1,
    anchorWeightKg: null, type: 'compound', ...extra,
  }
}

function day(dayKey: string, type: string, exercises: GymExercise[], muscle = 'back'): MesoDay {
  return { day: dayKey, type, muscle, exerciseCount: exercises.length, exercises }
}

const WEEK: MesoDay[] = [
  day('Hét', 'Upper', [ex('a', 'Döntött evezés', 'back', 4), ex('b', 'Arnold press', 'shoulder', 3)]),
  day('Kedd', 'Push', [ex('c', 'Oldalemelés', 'shoulder', 4)], 'shoulder'),
  day('Sze', 'Rest', [], ''),
  day('Csü', 'Pull', [ex('d', 'Húzódzkodás', 'back', 3)]),
]

describe('weekMuscleLoad', () => {
  test('sums working sets per budget group, sorted by sets descending', () => {
    const rows = weekMuscleLoad(WEEK, null)
    expect(rows.map((r) => [r.group, r.sets])).toEqual([['back', 7], ['shoulder', 7]])
    // tie broken by label: Hát before Váll
    expect(rows.map((r) => r.label)).toEqual(['Hát', 'Váll'])
  })

  test('target follows the tier: grow -> MAV, emphasize -> MRV, maintain -> MEV', () => {
    const grow = weekMuscleLoad(WEEK, null).find((r) => r.group === 'back')!
    expect(grow.tier).toBe('grow')
    expect(grow.target).toBe(16) // GROUP_LANDMARKS.back.mav

    const emph = weekMuscleLoad(WEEK, { back: 'emphasize' }).find((r) => r.group === 'back')!
    expect(emph.target).toBe(22) // .mrv

    const maint = weekMuscleLoad(WEEK, { back: 'maintain' }).find((r) => r.group === 'back')!
    expect(maint.target).toBe(10) // .mev
  })

  test('direction points at the target and toTarget is the distance', () => {
    const under = weekMuscleLoad(WEEK, null).find((r) => r.group === 'back')!
    expect(under.direction).toBe('up')
    expect(under.toTarget).toBe(9) // 16 - 7

    const over = weekMuscleLoad(WEEK, { back: 'maintain' }).find((r) => r.group === 'back')!
    expect(over.direction).toBe('down')
    expect(over.toTarget).toBe(3) // 7 - 10 -> |−3|
  })

  test('frequency counts the training days that hit the group', () => {
    const rows = weekMuscleLoad(WEEK, null)
    expect(rows.find((r) => r.group === 'back')!.frequency).toBe(2)
    expect(rows.find((r) => r.group === 'shoulder')!.frequency).toBe(2)
  })

  test('contributions list the days and exercises behind the number', () => {
    const back = weekMuscleLoad(WEEK, null).find((r) => r.group === 'back')!
    expect(back.contributions).toEqual([
      { day: 'Hét', type: 'Upper', sets: 4, exercises: [{ exerciseId: 'a', name: 'Döntött evezés', sets: 4 }] },
      { day: 'Csü', type: 'Pull', sets: 3, exercises: [{ exerciseId: 'd', name: 'Húzódzkodás', sets: 3 }] },
    ])
  })

  test('an explicit landmark override wins over the static table', () => {
    const rows = weekMuscleLoad(WEEK, null, { back: { mev: 4, mav: 6, mrv: 8 } })
    const back = rows.find((r) => r.group === 'back')!
    expect(back.target).toBe(6)
    expect(back.landmark).toEqual({ mev: 4, mav: 6, mrv: 8 })
  })

  test('exempt work and landmark-less groups are excluded', () => {
    const days = [day('Hét', 'Upper', [
      ex('p', 'Box jump', 'quad', 3, { countsTowardVolume: false }),
      ex('t', 'Shrug', 'traps', 3),
      ex('r', 'Evezés', 'back', 2),
    ])]
    expect(weekMuscleLoad(days, null).map((r) => r.group)).toEqual(['back'])
  })
})

describe('dayMuscleLoad', () => {
  test('per-group sets with cap flags, sorted by sets descending', () => {
    const d = day('Hét', 'Upper', [
      ex('a', 'Evezés', 'back', 8),
      ex('b', 'Press', 'shoulder', 7),
      ex('c', 'Fly', 'chest', 2),
    ])
    expect(dayMuscleLoad(d).map((r) => [r.group, r.sets, r.nearCap, r.over])).toEqual([
      ['back', 8, true, false],   // == cap: near, not over
      ['shoulder', 7, true, false], // cap - 1: near
      ['chest', 2, false, false],
    ])
  })

  test('over the cap sets over (and not nearCap)', () => {
    const d = day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 9)])
    expect(dayMuscleLoad(d)[0]).toMatchObject({ sets: 9, nearCap: false, over: true, cap: 8 })
  })

  test('each row lists the exercises behind it', () => {
    const d = day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 4), ex('b', 'Pulldown', 'back', 3)])
    expect(dayMuscleLoad(d)[0].exercises).toEqual([
      { exerciseId: 'a', name: 'Evezés', sets: 4 },
      { exerciseId: 'b', name: 'Pulldown', sets: 3 },
    ])
  })
})

describe('adjacentDayConflicts', () => {
  test('flags a group trained on two calendar-adjacent training days', () => {
    expect(adjacentDayConflicts(WEEK)).toEqual([
      { fromDay: 'Hét', fromType: 'Upper', toDay: 'Kedd', toType: 'Push', groups: [{ group: 'shoulder', label: 'Váll' }] },
    ])
  })

  test('a gap day breaks the adjacency', () => {
    const spread = [
      day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 4)]),
      day('Sze', 'Pull', [ex('b', 'Húzódzkodás', 'back', 4)]),
    ]
    expect(adjacentDayConflicts(spread)).toEqual([])
  })

  test('rest days neither conflict nor bridge', () => {
    const withRest = [
      day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 4)]),
      day('Kedd', 'Rest', [], ''),
      day('Sze', 'Pull', [ex('b', 'Húzódzkodás', 'back', 4)]),
    ]
    expect(adjacentDayConflicts(withRest)).toEqual([])
  })
})
