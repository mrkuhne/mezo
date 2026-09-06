import { describe, expect, test } from 'vitest'
import {
  STATE_LABEL, WINNER_LABEL, dayLabel, hhmm, losersOf, splitOf, stateOf, visualOf, washOf,
  winnerRuleOf,
} from '@/features/insights/logic/coachingCopy'
import { huMonthDay } from '@/shared/lib/dates'
import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import type { CoachingRule } from '@/data/types'

const rule = (over: Partial<CoachingRule>): CoachingRule => ({
  flagKey: 'k', label: 'L', domain: 'sleep', rank: 1, outcome: 'clear', reasonText: 'r',
  facts: [], ...over,
})

describe('the screen vocabulary', () => {
  test('a cooldown-suppressed raise reads Pihenőn, not Jelzett — it did not vanish', () => {
    const suppressed = rule({ outcome: 'raised', disposition: 'suppressed_by_cooldown' })
    expect(stateOf(suppressed)).toBe('suppressed')
    expect(STATE_LABEL[stateOf(suppressed)]).toBe('Pihenőn')
  })

  test('the four other states carry the spec words', () => {
    expect(STATE_LABEL[stateOf(rule({ outcome: 'raised', disposition: 'logged' }))]).toBe('Jelzett')
    expect(STATE_LABEL[stateOf(rule({ outcome: 'clear' }))]).toBe('Rendben')
    expect(STATE_LABEL[stateOf(rule({ outcome: 'unavailable' }))]).toBe('Nem mérhető')
    expect(WINNER_LABEL).toBe('Nyertes')
  })
})

describe('the round-2 guarantee', () => {
  test('an unknown domain falls back instead of rendering nothing', () => {
    const fallback = visualOf('something_the_frontend_has_never_seen')
    expect(fallback.wash).toBeTruthy()
    expect(fallback.icon).toBeTruthy()
    expect(fallback).toEqual(visualOf('general'))
  })

  test('every domain the server can send has its own visual', () => {
    for (const domain of ['sleep', 'training', 'nutrition', 'recovery', 'habits', 'logging', 'body']) {
      expect(visualOf(domain)).not.toEqual(visualOf('general'))
    }
  })

  test('the wash follows the OUTCOME: flagged = domain colour, fine = calm, unmeasurable = muted', () => {
    expect(washOf(rule({ outcome: 'raised', disposition: 'logged', domain: 'sleep' })))
      .toBe(visualOf('sleep').wash)
    expect(washOf(rule({ outcome: 'clear', domain: 'sleep' }))).toBe('sage')
    expect(washOf(rule({ outcome: 'unavailable', domain: 'sleep' }))).toBe('white')
  })
})

describe('the day, summarised', () => {
  const day = mockCoachingDay('2026-09-03')

  test('the split counts every rule exactly once', () => {
    const s = splitOf(day)
    expect(s.total).toBe(day.rules.length)
    expect(s.raised + s.suppressed + s.clear + s.unavailable).toBe(s.total)
    expect(s.raised).toBeGreaterThan(0)
    expect(s.suppressed).toBeGreaterThan(0)
  })

  test('the winner comes from day.winner, never from a cardOutcome guess (mezo-y43v)', () => {
    expect(winnerRuleOf(day)?.flagKey).toBe(day.winner?.flagKey)
    // A day whose winner has since gone clear still names it — and a stray `won` on some other
    // rule must not be able to hijack the badge.
    const drifted = {
      ...day,
      rules: day.rules.map((r) =>
        r.flagKey === day.winner?.flagKey
          ? { ...r, outcome: 'clear' as const, disposition: undefined, cardOutcome: undefined }
          : r),
    }
    expect(winnerRuleOf(drifted)?.flagKey).toBe(day.winner?.flagKey)
    expect(winnerRuleOf({ ...day, winner: undefined })).toBeUndefined()
  })

  test('the beaten candidates are the other logged raises, in severity order', () => {
    const losers = losersOf(day)
    expect(losers.map((r) => r.flagKey)).not.toContain(day.winner?.flagKey)
    losers.forEach((r) => expect(r.cardOutcome).toBe('lost'))
    expect(losers.map((r) => r.rank)).toEqual([...losers.map((r) => r.rank)].sort((a, b) => a - b))
  })
})

describe('the small copy', () => {
  test('hhmm renders the local wall clock of an instant', () => {
    const iso = '2026-09-03T14:00:00Z'
    const d = new Date(iso)
    const expected = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    expect(hhmm(iso)).toBe(expected)
  })

  test('the day label says ma / tegnap, then the date', () => {
    expect(dayLabel('2026-09-06', '2026-09-06')).toBe('ma')
    expect(dayLabel('2026-09-05', '2026-09-06')).toBe('tegnap')
    expect(dayLabel('2026-09-01', '2026-09-06')).toBe(huMonthDay('2026-09-01').toLowerCase())
  })
})
