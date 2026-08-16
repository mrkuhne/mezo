import { strengthWord } from '@/features/insights/logic/findings'
import type { AlignedDay, PatternEvent, PatternMonitorPair } from '@/data/types'

/**
 * Pure history/journal derivations for the pattern-pair detail page (mezo-tk88.5): turns the
 * append-only `PatternEvent` log into (a) a strength-over-time series for the chart and (b) a
 * human-readable Hungarian journal. No React, no formatting decisions left to the page — the page
 * just renders what comes out of here.
 */

// Lowercase Hungarian month abbreviations (mirrors `dates.ts`'s HU_MONTHS, lowercased — the
// history timeline wants "aug 13." not "Aug 13").
const HU_MONTHS = ['jan', 'feb', 'már', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szep', 'okt', 'nov', 'dec']

/** '2026-08-13T02:40:00Z' -> 'aug 13.' — the history-timeline's compact date style (mockup screen 2). */
function huShortDate(occurredAt: string): string {
  const [, m, d] = occurredAt.slice(0, 10).split('-').map(Number)
  return `${HU_MONTHS[m - 1]} ${d}.`
}

/** '2026-08-13' -> 'aug 13' — the strength chart axis's undotted date style (the journal's
 *  `huShortDate` wants a trailing period, the chart axis doesn't). */
export function chartDateLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${HU_MONTHS[m - 1]} ${d}`
}

// `strengthWord`'s three adverb tiers, remapped to the noun/adjective form usable before
// "jel"/"sávot" (the strength chart's own guide labels "érezhető · 0.3" / "határozott · 0.6").
// Keyed off `strengthWord`'s own output — never a second copy of its 0.3/0.6 thresholds — so the
// two bandings cannot drift apart.
const BAND_NAME_BY_STRENGTH_WORD: Record<string, string> = {
  kicsit: 'gyenge',
  érezhetően: 'érezhető',
  határozottan: 'határozott',
}

function bandName(r: number): string {
  return BAND_NAME_BY_STRENGTH_WORD[strengthWord(r)]
}

/** "a" vs "az" before a quoted band name, by its first letter. */
function aOrAz(word: string): string {
  return /^[aáeéiíoóöőuúüű]/i.test(word) ? 'az' : 'a'
}

function isoDateOnly(occurredAt: string): string {
  return occurredAt.slice(0, 10)
}

function dayDistance(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime())
}

export interface StrengthPoint {
  date: string
  absR: number
  kind: 'snapshot' | 'confirmed'
}

/**
 * Snapshots' |r| in chronological order; a `confirmed` event's day is plotted at the |r| of the
 * snapshot closest to it in time (there's no r on the confirm event itself — it's a decision, not
 * a re-run of the monitor).
 */
export function strengthSeries(events: PatternEvent[]): StrengthPoint[] {
  const snapshots = events
    .filter((e) => e.kind === 'snapshot' && e.r != null)
    .map((e) => ({ date: isoDateOnly(e.occurredAt), absR: Math.abs(e.r as number) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const points: StrengthPoint[] = snapshots.map((s) => ({ ...s, kind: 'snapshot' as const }))

  if (snapshots.length > 0) {
    for (const e of events) {
      if (e.kind !== 'confirmed') continue
      const date = isoDateOnly(e.occurredAt)
      let nearest = snapshots[0]
      for (const s of snapshots) {
        if (dayDistance(date, s.date) < dayDistance(date, nearest.date)) nearest = s
      }
      points.push({ date, absR: nearest.absR, kind: 'confirmed' })
    }
  }

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export interface StrengthTickLabel {
  text: string
  accent: boolean
}

/**
 * Per-point x-axis tick labels for the strength chart. A confirmed point always shows
 * "{date} ✓" in accent; a plain snapshot landing on the exact same calendar day as a confirmed
 * point (the common case — the monitor snapshot and the confirm decision happen the same day, see
 * `strengthSeries`) has its label suppressed so the axis doesn't repeat the date across two
 * adjacent slots. Index spacing (not real elapsed time) stays the chart's job.
 */
export function strengthTickLabels(points: StrengthPoint[]): StrengthTickLabel[] {
  const confirmedDates = new Set(points.filter((p) => p.kind === 'confirmed').map((p) => p.date))
  return points.map((p) => {
    if (p.kind === 'confirmed') return { text: `${chartDateLabel(p.date)} ✓`, accent: true }
    if (confirmedDates.has(p.date)) return { text: '', accent: false }
    return { text: chartDateLabel(p.date), accent: false }
  })
}

export interface JournalEntry {
  date: string
  tone: 'neutral' | 'success' | 'accent'
  text: string
  factLink?: boolean
}

/**
 * The append-only event log, translated into the Hungarian "what happened" journal shown on the
 * detail page. `promoted` never gets its own line — it only flips `factLink` on the `confirmed`
 * entry that preceded it, so the page can point at the knowledge-tár fact from there.
 */
export function journalEntries(events: PatternEvent[], pair: PatternMonitorPair | null): JournalEntry[] {
  if (!pair) return []

  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  const entries: JournalEntry[] = []
  let prevSnapshot: PatternEvent | null = null
  let sawFirstSnapshot = false

  for (const event of sorted) {
    switch (event.kind) {
      case 'snapshot': {
        if (event.r == null) break
        if (!sawFirstSnapshot) {
          entries.push({
            date: huShortDate(event.occurredAt),
            tone: 'neutral',
            text: `Életre kelt — ${event.n ?? 0} közös nap gyűlt össze, ${bandName(event.r)} jel.`,
          })
          sawFirstSnapshot = true
        } else if (prevSnapshot?.r != null && strengthWord(prevSnapshot.r) !== strengthWord(event.r)) {
          const newBand = bandName(event.r)
          const strengthened = Math.abs(event.r) > Math.abs(prevSnapshot.r)
          entries.push({
            date: huShortDate(event.occurredAt),
            tone: 'neutral',
            text: `A jel ${strengthened ? 'erősödött' : 'gyengült'}, átlépte ${aOrAz(newBand)} „${newBand}" sávot.`,
          })
        }
        prevSnapshot = event
        break
      }
      case 'confirmed': {
        const laterPromoted = sorted.some((e) => e.kind === 'promoted' && e.occurredAt > event.occurredAt)
        entries.push({
          date: huShortDate(event.occurredAt),
          tone: 'success',
          text: '**Megerősítetted.**',
          ...(laterPromoted ? { factLink: true } : {}),
        })
        break
      }
      case 'monitoring':
        entries.push({ date: huShortDate(event.occurredAt), tone: 'accent', text: 'Megfigyelésre tetted.' })
        break
      case 'rejected':
        entries.push({ date: huShortDate(event.occurredAt), tone: 'neutral', text: 'Elvetetted — befagyasztva.' })
        break
      case 'reinforced':
        entries.push({
          date: huShortDate(event.occurredAt),
          tone: 'accent',
          text: `Újra előjött ugyanabban az irányban — a tudás megerősödött (×${event.reinforcementCount ?? 1}).`,
        })
        break
      case 'promoted':
        // Folds into the preceding confirmed entry's factLink — no line of its own.
        break
    }
  }

  return entries
}

/** Least-squares fit of `b` on `a` over the aligned days — the scatter chart's trend line.
 *  `null` when there's nothing to fit (fewer than 2 points, or zero variance in `a`). */
export function fitLine(days: AlignedDay[]): { slope: number; intercept: number } | null {
  if (days.length < 2) return null

  const n = days.length
  const meanA = days.reduce((sum, d) => sum + d.a, 0) / n
  const meanB = days.reduce((sum, d) => sum + d.b, 0) / n

  let numerator = 0
  let denominator = 0
  for (const d of days) {
    numerator += (d.a - meanA) * (d.b - meanB)
    denominator += (d.a - meanA) ** 2
  }
  if (denominator === 0) return null

  const slope = numerator / denominator
  const intercept = meanB - slope * meanA
  return { slope, intercept }
}
