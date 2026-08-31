// Emberek S3 hub — pure derivations (mezo-06o0.2). Everything the Emberek hub decides
// (weekly rhythm strip, tone/context mixes, trend direction, quiet people, the week's
// "moment", hub headline lines) lives here so it is unit-testable without rendering.
// `now` is always a parameter — no Date.now() inside these functions.
import { describe, expect, test } from 'vitest'
import {
  contextBreakdown, directionFor, hubLines, quietPeople, toneMix, trendHeights,
  weekMoment, weeklyRhythm,
} from '@/features/me/logic/peopleDerive'
import type { Mention, PersonEntry } from '@/data/types'

const NOW = new Date('2026-08-31T18:00:00') // Monday

let mentionSeq = 0
function mention(over: Partial<Mention> = {}): Mention {
  mentionSeq += 1
  return {
    id: `m${mentionSeq}`,
    ts: NOW.toISOString(),
    dayLabel: 'H',
    timeLabel: '18:00',
    person_id: 'p1',
    personName: 'Petra',
    source: 'text',
    excerpt: 'x',
    ...over,
  }
}

let personSeq = 0
function person(over: Partial<PersonEntry> = {}): PersonEntry {
  personSeq += 1
  return {
    id: `pp${personSeq}`,
    name: `Person${personSeq}`,
    initial: 'P',
    relationship: 'friend',
    relationshipHu: 'Barát',
    aliases: [],
    status: 'active',
    sourceKind: 'manual',
    affect_baseline: 'neutral',
    mentionCount: 0,
    mentionsThisWeek: 0,
    last_mentioned_at: NOW.toISOString(),
    lastMentionLabel: 'ma',
    contactCadenceLabel: '',
    notes: '',
    affectTrend: [],
    knownFacts: [],
    ties: [],
    ...over,
  }
}

function daysAgo(n: number, hour = 12): Date {
  const d = new Date(NOW)
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d
}

describe('weeklyRhythm', () => {
  test('7 elements, today last with worst tone, older-than-8-days mentions excluded', () => {
    const todayPositive = mention({ ts: daysAgo(0).toISOString(), tone: 'positive' })
    const todayNegative = mention({ ts: daysAgo(0).toISOString(), tone: 'negative' })
    const twoDaysAgoMixed = mention({ ts: daysAgo(2).toISOString(), tone: 'mixed' })
    const tooOld = mention({ ts: daysAgo(8).toISOString(), tone: 'negative' })

    const days = weeklyRhythm([todayPositive, todayNegative, twoDaysAgoMixed, tooOld], NOW)

    expect(days).toHaveLength(7)
    expect(days[6]).toMatchObject({ count: 2, worstTone: 'negative', isToday: true })
    expect(days[4]).toMatchObject({ count: 1, worstTone: 'mixed' })
    for (const i of [0, 1, 2, 3, 5]) {
      expect(days[i]).toMatchObject({ count: 0, worstTone: null })
      expect(days[i].isToday).toBe(false)
    }
    // the 8-day-old mention must not land in any bucket
    const total = days.reduce((sum, d) => sum + d.count, 0)
    expect(total).toBe(3)
  })
})

describe('toneMix', () => {
  test('counts only tone-bearing mentions, rounds pct, descending by count', () => {
    const mentions = [
      mention({ tone: 'positive' }),
      mention({ tone: 'positive' }),
      mention({ tone: 'negative' }),
      mention({ tone: undefined }),
    ]
    expect(toneMix(mentions)).toEqual([
      { tone: 'positive', count: 2, pct: 67 },
      { tone: 'negative', count: 1, pct: 33 },
    ])
  })

  test('empty input -> []', () => {
    expect(toneMix([])).toEqual([])
  })
})

describe('directionFor', () => {
  test('last-2 average vs. earlier-points average, |diff| < 0.4 -> flat, <3 points -> flat', () => {
    expect(directionFor([3, 3, 3, 4, 5])).toBe('up')
    expect(directionFor([4, 4, 3, 2])).toBe('down')
    expect(directionFor([3, 3, 3, 3])).toBe('flat')
    expect(directionFor([4])).toBe('flat')
    expect(directionFor([])).toBe('flat')
  })
})

describe('contextBreakdown', () => {
  test('counts only contextLabel-bearing mentions, rounds pct, descending by count', () => {
    const mentions = [
      mention({ contextLabel: 'munka' }),
      mention({ contextLabel: 'munka' }),
      mention({ contextLabel: 'edzes' }),
      mention({ contextLabel: undefined }),
    ]
    expect(contextBreakdown(mentions)).toEqual([
      { ctx: 'munka', count: 2, pct: 67 },
      { ctx: 'edzes', count: 1, pct: 33 },
    ])
  })

  test('empty input -> []', () => {
    expect(contextBreakdown([])).toEqual([])
  })
})

describe('quietPeople', () => {
  test('people with zero mentions this week', () => {
    const loud = person({ mentionsThisWeek: 3 })
    const quiet = person({ mentionsThisWeek: 0 })
    expect(quietPeople([loud, quiet])).toEqual([quiet])
  })
})

describe('weekMoment', () => {
  test('a flagged mention wins regardless of tone', () => {
    const flagged = mention({ tone: 'positive', flagged: true, excerpt: 'short' })
    const negative = mention({ tone: 'negative', excerpt: 'a much longer excerpt here' })
    expect(weekMoment([negative, flagged])).toBe(flagged)
  })

  test('without a flagged mention, the first negative/mixed-tone mention wins', () => {
    const positive = mention({ tone: 'positive' })
    const mixed = mention({ tone: 'mixed' })
    const negative = mention({ tone: 'negative' })
    expect(weekMoment([positive, mixed, negative])).toBe(mixed)
  })

  test('without either, the longest excerpt wins', () => {
    const short = mention({ tone: 'positive', excerpt: 'short one' })
    const long = mention({ tone: 'neutral', excerpt: 'a considerably longer excerpt than the other' })
    expect(weekMoment([short, long])).toBe(long)
  })

  test('empty input -> null', () => {
    expect(weekMoment([])).toBeNull()
  })
})

describe('trendHeights', () => {
  test('scales a 1-5 trend onto px heights', () => {
    expect(trendHeights([5, 1], 42)).toEqual([42, 8])
  })

  test('empty input -> []', () => {
    expect(trendHeights([], 42)).toEqual([])
  })
})

describe('hubLines', () => {
  test('topName by mentionsThisWeek (ABC tie-break), down/up name by affectTrend direction, flagCount this week only', () => {
    const anna = person({ name: 'Anna', mentionsThisWeek: 3, affectTrend: [3, 3, 3, 3] })
    const bella = person({ name: 'Bella', mentionsThisWeek: 3, affectTrend: [4, 4, 2, 2] })
    const cili = person({ name: 'Cili', mentionsThisWeek: 1, affectTrend: [3, 3, 3, 4, 5] })

    const flaggedThisWeek1 = mention({ ts: daysAgo(0).toISOString(), flagged: true })
    const flaggedThisWeek2 = mention({ ts: daysAgo(1).toISOString(), flagged: true })
    const flaggedTooOld = mention({ ts: daysAgo(8).toISOString(), flagged: true })
    const unflagged = mention({ ts: daysAgo(0).toISOString(), flagged: false })

    const lines = hubLines(
      [anna, bella, cili],
      [flaggedThisWeek1, flaggedThisWeek2, flaggedTooOld, unflagged],
      NOW,
    )

    expect(lines).toEqual({
      mentionsThisWeek: 3, // flaggedThisWeek1 + flaggedThisWeek2 + unflagged — flaggedTooOld is outside the window
      topName: 'Anna',
      downName: 'Bella',
      upName: 'Cili',
      flagCount: 2,
    })
  })
})
