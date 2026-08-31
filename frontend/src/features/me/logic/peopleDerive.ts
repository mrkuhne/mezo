// Emberek S3 hub — pure derivations (mezo-06o0.2).
// Source: docs/design_2.0/prototypes/src/emberek-body.html, the hub-strip / mood-mix /
// context-breakdown / week-moment logic. Everything here is a pure function — `now` is
// always a parameter, never `Date.now()` — so the hub is unit-testable without rendering.
import type { Affect, Mention, MentionContext, PersonEntry } from '@/data/types'
import { TONE_ORDER } from '@/features/me/logic/peopleVisuals'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_LABELS = ['V', 'H', 'K', 'SZE', 'CS', 'P', 'SZO']

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Whole-day offset of `d` from `now`'s day (0 = today, 1 = yesterday, …). */
function dayOffset(ts: string, now: Date): number {
  const diff = startOfDay(now).getTime() - startOfDay(new Date(ts)).getTime()
  return Math.round(diff / DAY_MS)
}

// ── the shared "this week" window ───────────────────────────────────────────
//
// Two DIFFERENT, deliberate "this week" rules exist in this file, and every surface
// must use the one that matches what it renders — mixing them is exactly the bug this
// helper fixes (the hub showed "0 említés e héten" while Heti kép showed "10" on the
// very next screen, for the same seed data):
//
//  1. `weekWindow` (below) — rolling 7×24h back from the NEWEST mention's own
//     timestamp, never `Date.now()`. This is what every HEADLINE "N említés e héten"
//     COUNT uses: hubLines' mentionsThisWeek/topName/flagCount, Heti kép's tone-mix +
//     "A hét pillanata", and Említések's hero bignum + "Hét" scope filter. Anchoring on
//     the newest mention (instead of the real clock) keeps a frozen mock seed reading as
//     "this week" indefinitely, and stays close to live data (the newest mention IS
//     "now" for someone who just logged something).
//  2. `weeklyRhythm`'s own day buckets (below) stay anchored on `now` — its 7 columns
//     are calendar days ending TODAY by definition (a chart axis, "Mon Tue Wed…", not a
//     count), so they must track the real clock even when `weekWindow`'s data-anchored
//     count doesn't. Only weeklyRhythm's per-day BAR HEIGHTS use this; nothing that
//     reports a single "this week" number should.
//
// `PersonEntry.mentionsThisWeek` is a THIRD, separate thing on purpose: a persisted
// per-person cadence field (can legitimately diverge from a live recount of the
// mentions array). `quietPeople` and PeopleHetiPage's "Irányok"/"Csendben maradt"
// stay on it deliberately — they're about each person's own real cadence, not a
// recount of the mock mentions array — while hubLines' `topName` (a COUNT, per the
// rule above) is derived from `weekWindow` instead.
export interface WeekWindow { cutoff: number; inWindow: (m: Mention) => boolean }

export function weekWindow(mentions: Mention[], now: Date): WeekWindow {
  if (mentions.length === 0) {
    // No mentions at all -> nothing is "in window" (never "everything qualifies").
    return { cutoff: Infinity, inWindow: () => false }
  }
  const rawNewest = mentions.reduce((max, m) => Math.max(max, new Date(m.ts).getTime()), -Infinity)
  // Clamp to `now`: a mis-seeded/future-timestamped mention must never push the window
  // ahead of the real clock.
  const newest = Math.min(rawNewest, now.getTime())
  const cutoff = newest - 7 * DAY_MS
  return { cutoff, inWindow: (m) => new Date(m.ts).getTime() >= cutoff }
}

// ── weekly rhythm strip ─────────────────────────────────────────────────────

export interface RhythmDay { label: string; count: number; worstTone: Affect | null; isToday: boolean }

export function weeklyRhythm(mentions: Mention[], now: Date): RhythmDay[] {
  const days: RhythmDay[] = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push({ label: WEEK_LABELS[d.getDay()], count: 0, worstTone: null, isToday: i === 0 })
  }

  for (const m of mentions) {
    const offset = dayOffset(m.ts, now)
    if (offset < 0 || offset > 6) continue
    const day = days[6 - offset]
    day.count += 1
    if (m.tone) {
      const currentRank = day.worstTone ? TONE_ORDER.indexOf(day.worstTone) : Infinity
      const rank = TONE_ORDER.indexOf(m.tone)
      if (rank !== -1 && rank < currentRank) day.worstTone = m.tone
    }
  }

  return days
}

// ── tone mix ─────────────────────────────────────────────────────────────────

export interface ToneSlice { tone: Affect; count: number; pct: number }

export function toneMix(mentions: Mention[]): ToneSlice[] {
  const counts = new Map<Affect, number>()
  let total = 0
  for (const m of mentions) {
    if (!m.tone) continue
    counts.set(m.tone, (counts.get(m.tone) ?? 0) + 1)
    total += 1
  }
  if (total === 0) return []
  return [...counts.entries()]
    .map(([tone, count]) => ({ tone, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
}

// ── trend direction ──────────────────────────────────────────────────────────

export type Direction = 'up' | 'down' | 'flat'

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function directionFor(trend: number[]): Direction {
  if (trend.length < 3) return 'flat'
  const last2 = trend.slice(-2)
  const earlier = trend.slice(0, -2)
  const diff = average(last2) - average(earlier)
  if (Math.abs(diff) < 0.4) return 'flat'
  return diff > 0 ? 'up' : 'down'
}

// ── context breakdown ─────────────────────────────────────────────────────────

export interface CtxSlice { ctx: MentionContext; count: number; pct: number }

export function contextBreakdown(mentions: Mention[]): CtxSlice[] {
  const counts = new Map<MentionContext, number>()
  let total = 0
  for (const m of mentions) {
    if (!m.contextLabel) continue
    counts.set(m.contextLabel, (counts.get(m.contextLabel) ?? 0) + 1)
    total += 1
  }
  if (total === 0) return []
  return [...counts.entries()]
    .map(([ctx, count]) => ({ ctx, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
}

// ── quiet people ──────────────────────────────────────────────────────────────

export function quietPeople(people: PersonEntry[]): PersonEntry[] {
  return people.filter((p) => p.mentionsThisWeek === 0)
}

// ── the week's "moment" ────────────────────────────────────────────────────────

const HEAVY_TONES: Affect[] = ['negative', 'mixed']

export function weekMoment(weekMentions: Mention[]): Mention | null {
  if (weekMentions.length === 0) return null
  const flagged = weekMentions.find((m) => m.flagged)
  if (flagged) return flagged
  const heavy = weekMentions.find((m) => m.tone && HEAVY_TONES.includes(m.tone))
  if (heavy) return heavy
  return weekMentions.reduce((longest, m) => (m.excerpt.length > longest.excerpt.length ? m : longest))
}

// ── trend heights ─────────────────────────────────────────────────────────────

export function trendHeights(trend: number[], maxPx: number): number[] {
  return trend.map((v) => Math.round((v / 5) * maxPx))
}

// ── trend axis labels ────────────────────────────────────────────────────────

const HU_MONTHS_UP = ['JAN', 'FEB', 'MÁR', 'ÁPR', 'MÁJ', 'JÚN', 'JÚL', 'AUG', 'SZEP', 'OKT', 'NOV', 'DEC']

/**
 * PersonDetailPage's `.ppl-affax` month-range row under the mood-arc bars — the
 * prototype (emberek-body.html renderDet()) hardcodes 'JÚL'/'AUG'; this derives the
 * same two labels honestly from `now` instead: each trend point is one weekly
 * reading, so the window's earliest point sits `trend.length` weeks before `now`,
 * and its latest point IS `now`. The axis is just those two months' short Hungarian
 * uppercase abbreviations. An empty trend has no window to label — `null` (the
 * trend card already renders its own '—' empty state instead of bars).
 */
export function trendAxisLabels(trend: number[], now: Date): [string, string] | null {
  if (trend.length === 0) return null
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - trend.length * 7)
  return [HU_MONTHS_UP[start.getMonth()], HU_MONTHS_UP[now.getMonth()]]
}

// ── hub headline lines ────────────────────────────────────────────────────────

export interface HubLines {
  mentionsThisWeek: number
  topName: string | null
  downName: string | null
  upName: string | null
  flagCount: number
}

export function hubLines(people: PersonEntry[], mentions: Mention[], now: Date): HubLines {
  const { inWindow } = weekWindow(mentions, now)
  const weekMentions = mentions.filter(inWindow)

  // topName is a COUNT (see the weekWindow doc above) -> derived from a live recount of
  // weekMentions per person, NOT PersonEntry.mentionsThisWeek. topCount starts at 0 (not
  // -1) so an all-quiet week — nobody has a single mention inside the window — leaves
  // topName `null` instead of fabricating a "most active" person out of a 0-mention tie.
  const countsByPerson = new Map<string, number>()
  for (const m of weekMentions) {
    countsByPerson.set(m.person_id, (countsByPerson.get(m.person_id) ?? 0) + 1)
  }
  let topName: string | null = null
  let topCount = 0
  for (const p of [...people].sort((a, b) => a.name.localeCompare(b.name))) {
    const count = countsByPerson.get(p.id) ?? 0
    if (count > topCount) {
      topCount = count
      topName = p.name
    }
  }

  const downPerson = people.find((p) => directionFor(p.affectTrend) === 'down')
  const upPerson = people.find((p) => directionFor(p.affectTrend) === 'up')

  return {
    mentionsThisWeek: weekMentions.length,
    topName,
    downName: downPerson?.name ?? null,
    upName: upPerson?.name ?? null,
    flagCount: weekMentions.filter((m) => m.flagged).length,
  }
}
