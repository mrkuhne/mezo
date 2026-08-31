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

/** The shared "this week" window every hub line agrees on: today and the 6 days before it. */
function isThisWeek(ts: string, now: Date): boolean {
  const offset = dayOffset(ts, now)
  return offset >= 0 && offset <= 6
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
  const weekMentions = mentions.filter((m) => isThisWeek(m.ts, now))

  let topName: string | null = null
  let topCount = -1
  for (const p of [...people].sort((a, b) => a.name.localeCompare(b.name))) {
    if (p.mentionsThisWeek > topCount) {
      topCount = p.mentionsThisWeek
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
