import { strengthWord } from '@/features/insights/logic/findings'
import { binaryGroupLabels } from '@/features/insights/logic/metricFormat'
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

/**
 * The strength card's caption (mezo-tk88.5 review fix) — direction-aware off the FIRST and LAST
 * snapshot's |r| (never the mixed snapshot+confirmed `points`' extremes wholesale — a `confirmed`
 * point's own date can, in principle, sit outside the snapshot range, so this filters back down to
 * `kind === 'snapshot'` before comparing). The old copy always read "erősödik", which was honest
 * for the showcase seed but WRONG for a weakening history — this branches three ways: `firstN`/
 * `lastN` are the first/last snapshot's `n` (from `firstLastSnapshotN`), kept separate from the
 * |r| comparison so the sentence's two numbers and its direction can never disagree with each
 * other's source data.
 */
export function strengthTrendCaption(points: StrengthPoint[], firstN: number, lastN: number): string {
  const snapshots = points.filter((p) => p.kind === 'snapshot')
  const first = snapshots[0] ?? points[0]
  const last = snapshots[snapshots.length - 1] ?? points[points.length - 1]
  const delta = last.absR - first.absR
  const sameBand = strengthWord(first.absR) === strengthWord(last.absR)

  if (sameBand && Math.abs(delta) < 0.05) {
    return `A jel stabil, ahogy gyűlnek a közös napok — ${firstN} napról ${lastN}-re.`
  }
  if (delta > 0) {
    return `A jel folyamatosan erősödik, ahogy gyűlnek a közös napok — ${firstN} napról ${lastN}-re.`
  }
  return `A jel gyengült az utóbbi futások során — ${firstN} napról ${lastN}-re nőtt a közös napok száma.`
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
  let sawFirstSnapshot = false

  for (const event of sorted) {
    switch (event.kind) {
      case 'snapshot': {
        if (!sawFirstSnapshot) {
          entries.push({
            date: huShortDate(event.occurredAt),
            tone: 'neutral',
            text: `Először számolhatóvá vált — ${event.n ?? 0} közös nap.`,
          })
          sawFirstSnapshot = true
        }
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

  if (pair.verdict === 'imbalanced_groups'
    && pair.groupZeroDays != null
    && pair.groupOneDays != null
    && pair.requiredPerGroup != null) {
    const labels = binaryGroupLabels(pair.metricAKey)
    const deficient = pair.groupZeroDays <= pair.groupOneDays
      ? { count: pair.groupZeroDays, day: labels.zero.day }
      : { count: pair.groupOneDays, day: labels.one.day }
    entries.push({
      date: 'Most',
      tone: 'accent',
      text: `Még gyűlik — ${deficient.count}/${pair.requiredPerGroup} ${deficient.day} nap.`,
    })
  }

  return entries
}

/**
 * The detail page's strength-card caption needs the raw `n` (common-day count) of the FIRST and
 * LAST snapshot — not their |r| (that's `strengthSeries`'s job). `null` on fewer than 2 snapshots
 * carrying an `n`, which is the page's own signal to show the "no history yet" fallback instead.
 */
export function firstLastSnapshotN(events: PatternEvent[]): { first: number; last: number } | null {
  const ns = events
    .filter((e) => e.kind === 'snapshot' && e.n != null)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((e) => e.n as number)
  if (ns.length < 2) return null
  return { first: ns[0], last: ns[ns.length - 1] }
}

/** The most recent aligned day (by ISO date), for the scatter card's "kiemelt a legutóbbi" caption.
 *  `null` on an empty list. */
export function latestAlignedDay(days: AlignedDay[]): AlignedDay | null {
  if (days.length === 0) return null
  return days.reduce((acc, d) => (d.date > acc.date ? d : acc), days[0])
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
