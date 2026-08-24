import { expect, test } from 'vitest'
import type { MesoDay } from '@/data/types'
import { seedDays, toDayInputs } from '@/features/train/logic/mesoDays'

const days: MesoDay[] = [
  {
    day: 'Hét', type: 'Push', muscle: 'chest', exerciseCount: 1, muscleAccent: false,
    exercises: [{
      id: 'x1', name: 'Bench', muscle: 'chest-mid', warmupSets: 2, workingSets: 4,
      repMin: 6, repMax: 8, targetRIR: 1, anchorWeightKg: 60, type: 'compound',
    }],
  },
  { day: 'Kedd', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] },
]

test('seedDays clones every day AND its exercises (edits never touch the source)', () => {
  const seeded = seedDays(days)
  seeded[0].exercises[0].workingSets = 9
  seeded[0].exerciseCount = 0
  expect(days[0].exercises[0].workingSets).toBe(4)
  expect(days[0].exerciseCount).toBe(1)
})

test('toDayInputs keeps rest days, drops exercise ids and blanks a falsy muscleAccent', () => {
  const inputs = toDayInputs(days)
  expect(inputs).toHaveLength(2)
  expect(inputs[1]).toMatchObject({ day: 'Kedd', type: 'Rest', exercises: [] })
  expect(inputs[0].muscleAccent).toBeUndefined()
  expect(inputs[0].exercises![0]).not.toHaveProperty('id')
  expect(inputs[0].exercises![0]).toMatchObject({ name: 'Bench', workingSets: 4, anchorWeightKg: 60 })
})

test('toDayInputs carries countsTowardVolume so the toggle survives a save', () => {
  const inputs = toDayInputs([{
    day: 'Hét', type: 'Pull', muscle: 'back', exerciseCount: 1,
    exercises: [
      { id: 'x', name: 'Dead Hang', muscle: 'back-wide', warmupSets: 0, workingSets: 2,
        repMin: 45, repMax: 60, targetRIR: 0, type: 'plyo', countsTowardVolume: false },
    ],
  }])
  expect(inputs[0].exercises?.[0].countsTowardVolume).toBe(false)
})
