import { describe, expect, test } from 'vitest'
import {
  windDownPhase, minsToBed, fmtMinsToBed, isDarkWindow,
} from '@/features/today/logic/windDown'

const at = (hhmm: string) => new Date(`2026-07-24T${hhmm}:00`)
const GOAL = { bedTime: '22:00', wakeTime: '06:00' }        // ghost anchor
const WRAP = { bedTime: '00:15', wakeTime: '08:00' }        // past-midnight bed

describe('windDownPhase', () => {
  test('daytime is none', () => {
    expect(windDownPhase(at('15:00'), GOAL)).toBe('none')
    expect(windDownPhase(at('20:29'), GOAL)).toBe('none')
  })
  test('dim window is [bed-90, bed-60)', () => {
    expect(windDownPhase(at('20:30'), GOAL)).toBe('dim')
    expect(windDownPhase(at('20:59'), GOAL)).toBe('dim')
    expect(windDownPhase(at('21:00'), GOAL)).toBe('winddown')
  })
  test('winddown window is [bed-60, bed)', () => {
    expect(windDownPhase(at('21:59'), GOAL)).toBe('winddown')
    expect(windDownPhase(at('22:00'), GOAL)).toBe('night')
  })
  test('night window is [bed, wake-30)', () => {
    expect(windDownPhase(at('03:00'), GOAL)).toBe('night')
    expect(windDownPhase(at('05:29'), GOAL)).toBe('night')
    expect(windDownPhase(at('05:30'), GOAL)).toBe('none')
  })
  test('past-midnight bed wraps correctly', () => {
    expect(windDownPhase(at('22:44'), WRAP)).toBe('none')
    expect(windDownPhase(at('22:45'), WRAP)).toBe('dim')
    expect(windDownPhase(at('23:45'), WRAP)).toBe('winddown')
    expect(windDownPhase(at('00:14'), WRAP)).toBe('winddown')
    expect(windDownPhase(at('00:15'), WRAP)).toBe('night')
    expect(windDownPhase(at('07:29'), WRAP)).toBe('night')
    expect(windDownPhase(at('07:30'), WRAP)).toBe('none')
  })
})

describe('minsToBed / fmtMinsToBed', () => {
  test('forward circular distance to bed', () => {
    expect(minsToBed(at('20:30'), '22:00')).toBe(90)
    expect(minsToBed(at('21:22'), '22:00')).toBe(38)
    expect(minsToBed(at('23:40'), '00:15')).toBe(35)
  })
  test('formats hours + minutes in Hungarian', () => {
    expect(fmtMinsToBed(72)).toBe('1 ó 12 p')
    expect(fmtMinsToBed(90)).toBe('1 ó 30 p')
    expect(fmtMinsToBed(38)).toBe('38 p')
  })
})

describe('isDarkWindow', () => {
  test('dark exactly while any phase is active', () => {
    expect(isDarkWindow(at('15:00'), GOAL)).toBe(false)
    expect(isDarkWindow(at('20:30'), GOAL)).toBe(true)
    expect(isDarkWindow(at('03:00'), GOAL)).toBe(true)
    expect(isDarkWindow(at('05:30'), GOAL)).toBe(false)
  })
})
