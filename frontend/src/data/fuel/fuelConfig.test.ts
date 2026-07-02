import { describe, it, expect } from 'vitest'
import { slotKeyOfLabel, toHHmm, toMin } from '@/data/fuel/fuelConfig'

describe('slotKeyOfLabel', () => {
  it('maps the planner window labels to the MealSlot enum', () => {
    expect(slotKeyOfLabel('Reggeli')).toBe('breakfast')
    expect(slotKeyOfLabel('Ebéd')).toBe('lunch')
    expect(slotKeyOfLabel('Vacsora')).toBe('dinner')
  })
  it('falls back to snack for any other label (Uzsonna, Tízórai, Esti snack, …)', () => {
    expect(slotKeyOfLabel('Uzsonna')).toBe('snack')
    expect(slotKeyOfLabel('Tízórai')).toBe('snack')
    expect(slotKeyOfLabel('Esti snack')).toBe('snack')
    expect(slotKeyOfLabel('bármi')).toBe('snack')
  })
})

describe('time helpers (sanity)', () => {
  it('round-trips minutes ↔ HH:mm', () => {
    expect(toHHmm(toMin('21:30'))).toBe('21:30')
  })
})
