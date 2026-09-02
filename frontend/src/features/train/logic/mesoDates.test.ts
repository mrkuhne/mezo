import { describe, expect, test } from 'vitest'
import { addWeeks, getSeason, todayDayToken } from '@/features/train/logic/mesoDates'

describe('addWeeks', () => {
  test('adds whole weeks across HU month boundaries', () => {
    // Jún 16 + 6 weeks (42 days) = Jún 58 → Jún has 30 days → Júl 28
    expect(addWeeks('Jún 16', 6)).toBe('Júl 28')
  })

  test('stays within the month when no overflow', () => {
    expect(addWeeks('Jún 1', 1)).toBe('Jún 8')
  })
})

describe('getSeason', () => {
  test('maps HU month to season', () => {
    expect(getSeason('Jún 16')).toBe('Nyár')
    expect(getSeason('Ápr 2')).toBe('Tavasz')
    expect(getSeason('Okt 9')).toBe('Ősz')
    expect(getSeason('Jan 1')).toBe('Tél')
  })
})

describe('todayDayToken', () => {
  test('rolls JS Sunday=0..Saturday=6 to the Monday-first DAY_ORDER token', () => {
    expect(todayDayToken(new Date('2026-07-15T12:00:00'))).toBe('Sze') // Wednesday
    expect(todayDayToken(new Date('2026-07-13T12:00:00'))).toBe('Hét') // Monday
    expect(todayDayToken(new Date('2026-07-19T12:00:00'))).toBe('Vas') // Sunday
  })
})
