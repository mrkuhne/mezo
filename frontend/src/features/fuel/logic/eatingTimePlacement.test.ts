import { describe, expect, it } from 'vitest'
import type { FuelSlot, MealSlot } from '@/data/types'
import { resolveEatingTimePlacement } from '@/features/fuel/logic/eatingTimePlacement'

const windowSlot = (slotKey: MealSlot, from: string, to: string): FuelSlot => ({
  time: from, kind: slotKey === 'snack' ? 'snack' : 'meal', label: slotKey,
  slotKey, state: 'pending', windowFrom: from, windowTo: to,
})

const windows = [
  windowSlot('breakfast', '07:00', '10:00'),
  windowSlot('lunch', '12:00', '14:30'),
  windowSlot('snack', '16:00', '17:30'),
]

describe('resolveEatingTimePlacement', () => {
  it('finds breakfast at both inclusive edges', () => {
    expect(resolveEatingTimePlacement('07:00', windows)).toEqual({
      slot: 'breakfast', window: { from: '07:00', to: '10:00' }, label: 'breakfast',
    })
    expect(resolveEatingTimePlacement('10:00', windows).slot).toBe('breakfast')
  })

  it('moves a late breakfast log to the matching snack window', () => {
    expect(resolveEatingTimePlacement('16:20', windows)).toEqual({
      slot: 'snack', window: { from: '16:00', to: '17:30' }, label: 'snack',
    })
  })

  it('leaves the planned window empty between slots and after the last slot', () => {
    expect(resolveEatingTimePlacement('11:00', windows)).toEqual({ slot: 'lunch', label: null })
    expect(resolveEatingTimePlacement('22:10', windows)).toEqual({ slot: 'snack', label: null })
  })

  it('matches a window that crosses midnight', () => {
    const late = [windowSlot('snack', '23:30', '01:00')]
    expect(resolveEatingTimePlacement('00:30', late).window).toEqual({ from: '23:30', to: '01:00' })
    expect(resolveEatingTimePlacement('23:45', late).slot).toBe('snack')
    expect(resolveEatingTimePlacement('02:00', late).window).toBeUndefined()
  })

  it('ignores incomplete or non-meal windows', () => {
    const incomplete = { ...windowSlot('breakfast', '07:00', '10:00'), windowTo: undefined }
    const nonMeal = { ...windowSlot('lunch', '12:00', '14:30'), kind: 'block' as const }
    expect(resolveEatingTimePlacement('08:00', [incomplete])).toEqual({ slot: 'breakfast', label: null })
    expect(resolveEatingTimePlacement('13:00', [nonMeal])).toEqual({ slot: 'lunch', label: null })
  })
})
