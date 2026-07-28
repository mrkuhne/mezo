import { describe, expect, test } from 'vitest'
import { SESSION_STATE_LABEL, sessionState } from '@/features/train/logic/sessionState'

const now = new Date('2026-05-19T12:30:00')

describe('sessionState', () => {
  test('today within ±1h of now is "now"', () => {
    expect(sessionState({ dayIso: '2026-05-19', todayIso: '2026-05-19', timeOfDay: '12:00', now })).toBe('now')
    expect(sessionState({ dayIso: '2026-05-19', todayIso: '2026-05-19', timeOfDay: '13:25', now })).toBe('now')
  })

  test('today outside the window is "today"', () => {
    expect(sessionState({ dayIso: '2026-05-19', todayIso: '2026-05-19', timeOfDay: '18:00', now })).toBe('today')
    expect(sessionState({ dayIso: '2026-05-19', todayIso: '2026-05-19', timeOfDay: '07:00', now })).toBe('today')
  })

  test('an untimed session today is "today", never "now"', () => {
    expect(sessionState({ dayIso: '2026-05-19', todayIso: '2026-05-19', timeOfDay: null, now })).toBe('today')
  })

  test('a past day is "missed" and a future day is "planned"', () => {
    expect(sessionState({ dayIso: '2026-05-18', todayIso: '2026-05-19', timeOfDay: '18:00', now })).toBe('missed')
    expect(sessionState({ dayIso: '2026-05-21', todayIso: '2026-05-19', timeOfDay: '07:00', now })).toBe('planned')
  })

  test('labels are the agreed four Hungarian words', () => {
    expect(SESSION_STATE_LABEL).toEqual({ now: 'MOST', today: 'MA', missed: 'ELMARADT', planned: 'TERVEZETT' })
  })
})
