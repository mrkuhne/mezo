import { describe, expect, it } from 'vitest'
import { minutesUntil, ritualWindowState } from '@/features/ritual/logic/ritualWindow'

const W = { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' }
const at = (h: number, m: number) => new Date(2026, 6, 25, h, m)

describe('ritualWindowState', () => {
  it('waiting before opensAt', () => expect(ritualWindowState(at(20, 0), W)).toBe('waiting'))
  it('open from opensAt', () => expect(ritualWindowState(at(21, 15), W)).toBe('open'))
  it('stays open after bedTime (soft window — the day is still closable)', () =>
    expect(ritualWindowState(at(23, 30), W)).toBe('open'))
  it('midnight-wrap: bed 00:30 → opensAt 23:15 opens late evening, still waiting at 21:00', () => {
    const wrap = { opensAt: '23:15', prepStartsAt: '23:45', bedTime: '00:30' }
    expect(ritualWindowState(at(21, 0), wrap)).toBe('waiting')
    expect(ritualWindowState(at(23, 20), wrap)).toBe('open')
    expect(ritualWindowState(at(0, 10), wrap)).toBe('open')
  })
})

describe('minutesUntil', () => {
  it('same evening', () => expect(minutesUntil(at(20, 0), '21:15')).toBe(75))
  it('wraps past midnight', () => expect(minutesUntil(at(23, 50), '00:30')).toBe(40))
})
