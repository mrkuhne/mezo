// Emberek S3 hub — pure derivations (mezo-06o0.2). Everything the Emberek hub decides
// (weekly rhythm strip, tone/context mixes, trend direction, quiet people, the week's
// "moment", hub headline lines) lives here so it is unit-testable without rendering.
// `now` is always a parameter — no Date.now() inside these functions.
import { describe, expect, test } from 'vitest'
import {
  contextBreakdown, directionFor, hubLines, quietPeople, toneMix, trendHeights,
  weekMoment, weeklyRhythm, weekWindow,
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
    graphEdges: [],
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

describe('weekWindow', () => {
  test('anchors on the NEWEST mention\'s own ts (7*24h back, inclusive) — never `Date.now()`', () => {
    const newest = mention({ ts: daysAgo(0).toISOString() })
    const edge = mention({ ts: daysAgo(7).toISOString() }) // exactly newest - 7d -> IN
    const justOutside = mention({ ts: daysAgo(7, 11).toISOString() }) // 1h before cutoff -> OUT
    const older = mention({ ts: daysAgo(10).toISOString() })

    const { inWindow } = weekWindow([newest, edge, justOutside, older], NOW)
    expect(inWindow(newest)).toBe(true)
    expect(inWindow(edge)).toBe(true)
    expect(inWindow(justOutside)).toBe(false)
    expect(inWindow(older)).toBe(false)
  })

  test('no mentions at all -> nothing is in window (never "everything qualifies")', () => {
    const { inWindow, cutoff } = weekWindow([], NOW)
    expect(cutoff).toBe(Infinity)
    expect(inWindow(mention())).toBe(false)
  })

  test('clamps to `now` — a future-timestamped mention never pushes the window ahead of the real clock', () => {
    const future = mention({ ts: daysAgo(-30).toISOString() })
    const recent = mention({ ts: daysAgo(3).toISOString() })
    const tooOld = mention({ ts: daysAgo(9).toISOString() })

    // Anchored (uncapped) on `future`'s own ts, `recent` (3 days ago) would fall well
    // outside a cutoff of `future - 7d`; clamped to `now`, the cutoff is `now - 7d` and
    // `recent` survives while `tooOld` still doesn't.
    const { inWindow } = weekWindow([future, recent, tooOld], NOW)
    expect(inWindow(recent)).toBe(true)
    expect(inWindow(tooOld)).toBe(false)
  })
})

describe('hubLines', () => {
  test('topName is the person with the most mentions actually inside the shared week window (never PersonEntry.mentionsThisWeek)', () => {
    const anna = person({ name: 'Anna', mentionsThisWeek: 99 }) // deliberately stale/wrong field
    const bella = person({ name: 'Bella', mentionsThisWeek: 0 })
    const cili = person({ name: 'Cili', mentionsThisWeek: 0 })

    // Bella has 2 real mentions inside the window, Anna only 1 — despite Anna's stale
    // mentionsThisWeek=99 — proving topName ignores the persisted field entirely.
    const annaMention = mention({ person_id: anna.id, ts: daysAgo(0).toISOString() })
    const bellaMention1 = mention({ person_id: bella.id, ts: daysAgo(1).toISOString() })
    const bellaMention2 = mention({ person_id: bella.id, ts: daysAgo(2).toISOString() })

    const lines = hubLines([anna, bella, cili], [annaMention, bellaMention1, bellaMention2], NOW)
    expect(lines.topName).toBe('Bella')
  })

  test('down/up name by affectTrend direction, flagCount only for mentions inside the shared week window', () => {
    const anna = person({ name: 'Anna', affectTrend: [3, 3, 3, 3] })
    const bella = person({ name: 'Bella', affectTrend: [4, 4, 2, 2] })
    const cili = person({ name: 'Cili', affectTrend: [3, 3, 3, 4, 5] })

    const flaggedThisWeek1 = mention({ person_id: anna.id, ts: daysAgo(0).toISOString(), flagged: true })
    const flaggedThisWeek2 = mention({ person_id: anna.id, ts: daysAgo(1).toISOString(), flagged: true })
    const flaggedTooOld = mention({ person_id: anna.id, ts: daysAgo(8).toISOString(), flagged: true })
    const unflagged = mention({ person_id: anna.id, ts: daysAgo(0).toISOString(), flagged: false })

    const lines = hubLines(
      [anna, bella, cili],
      [flaggedThisWeek1, flaggedThisWeek2, flaggedTooOld, unflagged],
      NOW,
    )

    expect(lines.mentionsThisWeek).toBe(3) // flaggedThisWeek1 + flaggedThisWeek2 + unflagged — flaggedTooOld is outside the window
    expect(lines.downName).toBe('Bella')
    expect(lines.upName).toBe('Cili')
    expect(lines.flagCount).toBe(2)
  })

  test('CONTRACT: no mentions at all -> topName null, never a fabricated 0-mention "most active" person', () => {
    const anna = person({ name: 'Anna', mentionsThisWeek: 0 })
    const bella = person({ name: 'Bella', mentionsThisWeek: 0 })

    const lines = hubLines([anna, bella], [], NOW)
    expect(lines.topName).toBeNull()
    expect(lines.mentionsThisWeek).toBe(0)
  })

  test('CONTRACT: mentions in window all belong to people outside the roster -> every listed person\'s real count is 0, topName stays null', () => {
    const anna = person({ name: 'Anna', mentionsThisWeek: 0 })
    const bella = person({ name: 'Bella', mentionsThisWeek: 0 })
    // Belongs to nobody in [anna, bella] — e.g. a since-deleted person's stray mention.
    const orphanMention = mention({ person_id: 'not-in-roster', ts: daysAgo(0).toISOString() })

    const lines = hubLines([anna, bella], [orphanMention], NOW)
    expect(lines.topName).toBeNull()
    expect(lines.mentionsThisWeek).toBe(1) // the mention itself is still counted honestly
  })
})

describe('cross-page week-count coherence', () => {
  test('hubLines\' weekly count equals a direct weekWindow recount for the same data — the hub and the sibling pages can never again disagree', () => {
    const mentions = [
      mention({ ts: daysAgo(0).toISOString() }),
      mention({ ts: daysAgo(3).toISOString() }),
      mention({ ts: daysAgo(6).toISOString() }),
      mention({ ts: daysAgo(9).toISOString() }), // outside the window
    ]
    const people = [person()]

    const { mentionsThisWeek } = hubLines(people, mentions, NOW)
    const { inWindow } = weekWindow(mentions, NOW)
    const directCount = mentions.filter(inWindow).length

    expect(mentionsThisWeek).toBe(directCount)
    expect(mentionsThisWeek).toBe(3)
  })
})
