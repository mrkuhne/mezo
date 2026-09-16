// ============================================================
// Mezo · Plan-library story — pure, React-free.
//
// Read-only narration the T10 library pages need: a closed
// run's "how did it go" stars + sentence (runStars), and a template's "where does
// it stand" counts across every run started from it (templateStory). Neither
// re-derives anything cerScore.ts already owns — runStars halves its stars via
// the shared `starsFor`, so a run's rating always agrees with the ceremony's own.
// Task 3 added the template PAGE's two derivations on the same terms: `templateRuns`
// (the matched runs themselves, which `templateStory` now counts), `templateUseLine`
// (the card's one plain line) and `templateWeekSets` (working sets per muscle across
// the template's week, summed through the shared `daySessionBreakdown` — never a
// second inline volume rule).
// ============================================================
import type { MesoTemplate, Mesocycle } from '@/data/types'
import { starsFor } from './cerScore'
import { SPLIT_LABELS } from './mesoPlan'
import { isOffDay } from './offDay'
import { estimateSessionMinutes } from './sessionLength'
import { daySessionBreakdown } from './setBudget'

export interface RunStars {
  /** completionPct/100, clamped 0..1 — the ratio fed to starsFor. */
  share: number
  /** Halves, via cerScore.starsFor(share). */
  stars: number
  say: string
}

/**
 * A closed run's delivery share → halves stars (via cerScore.starsFor — never
 * re-derived here) plus an adherence-neutral one-liner. `completionPct` is a
 * 0..100 percentage; `null` (no data yet) passes through as `null`.
 */
export function runStars(completionPct: number | null): RunStars | null {
  if (completionPct === null) return null
  const share = Math.max(0, Math.min(1, completionPct / 100))
  const stars = starsFor(share)
  const say =
    share >= 0.95 ? 'Végigvitted.'
      : share >= 0.75 ? 'Erős futam volt.'
      : share >= 0.5 ? 'A nagyobb fele megvan.'
      : share > 0 ? 'Elindult, aztán másfelé vitt az élet.'
      : 'Ez a futam nem indult el.'
  return { share, stars, say }
}

export interface TemplateStory {
  /** Any non-archived run from this template currently has status 'active'. */
  activeNow: boolean
  /** Runs from this template still 'planned' (queued, not yet started). */
  plannedCount: number
  /** Runs from this template that are 'archived' (closed). */
  closedCount: number
}

/**
 * Which runs (Mesocycle instances) came from a given template, and how they're
 * doing. Matching key: `Mesocycle.templateId` (data/types.ts:1327) carries the
 * originating template's id once a run was started from the wizard's "start
 * from template" flow; legacy/direct runs have `templateId` null/undefined. So
 * we match a run by `templateId` when THAT RUN carries one, and fall back to
 * matching by name (title or shortTitle) only for runs with no templateId —
 * this keeps two same-named-but-different templates from bleeding into each
 * other's counts while still covering pre-templateId legacy runs.
 */
export function templateStory(
  templateId: string,
  templateName: string,
  mesocycles: Mesocycle[],
): TemplateStory {
  const runs = templateRuns(templateId, templateName, mesocycles)
  return {
    activeNow: runs.active !== null,
    plannedCount: runs.planned.length,
    closedCount: runs.closed.length,
  }
}

/** The runs themselves, not just their counts — what the template page's „Futamok ebből a
 *  sablonból" list needs (each row links at its own destination, so it needs the ids). Same
 *  matching key as `templateStory`, which is built on top of this. */
export interface TemplateRuns {
  /** The one run from this template currently active, or null. */
  active: Mesocycle | null
  /** Runs still queued, in list order. */
  planned: Mesocycle[]
  /** Closed (archived) runs, in list order. */
  closed: Mesocycle[]
}

export function templateRuns(
  templateId: string,
  templateName: string,
  mesocycles: Mesocycle[],
): TemplateRuns {
  const matches = mesocycles.filter((m) =>
    m.templateId != null
      ? m.templateId === templateId
      : m.title === templateName || m.shortTitle === templateName,
  )
  return {
    active: matches.find((m) => m.status === 'active') ?? null,
    planned: matches.filter((m) => m.status === 'planned'),
    closed: matches.filter((m) => m.status === 'archived'),
  }
}

/**
 * The one plain line a template card carries about where it stands — the prototype's own
 * `templateCard` wording (plan-pages.js:393-408), jargon-free: a running plan first, then
 * how many runs ever came out of it, then the honest "none yet". A QUEUED run is not a run
 * that happened, so it never counts here (it shows up on the template's own page instead).
 */
export function templateUseLine(story: TemplateStory): string {
  if (story.activeNow) return 'Ebből fut a mostani terved'
  if (story.closedCount > 0) return `${story.closedCount} lezárt futam jött ki belőle`
  return 'Még nem indítottál belőle'
}

const clampDays = (n: number) => Math.min(6, Math.max(2, n))

/** Training days in a template's week = everything that is not a rest/sport day (the
 *  shared off-day rule — a template's split is its TRAINING days, nothing else). */
export function trainingDayCount(template: MesoTemplate): number {
  return (template.days ?? []).filter((d) => !isOffDay(d)).length
}

/**
 * The split's head („Upper / Lower · 4×/hét" → „Upper / Lower") — the „×/hét" tail is
 * already said by the nap-hetente fact beside it. A template with no split text falls back
 * to the band-model label its training-day count implies (the `MesoTemplateCard` rule);
 * one with no training day at all has nothing to say here, so: null.
 */
export function splitLabel(template: MesoTemplate): string | null {
  const head = template.split?.split(' · ')[0]?.trim()
  if (head) return head
  const days = trainingDayCount(template)
  return days > 0 ? SPLIT_LABELS[clampDays(days)] : null
}

/**
 * A typical session's length in whole minutes for this template — the mean over its
 * TRAINING days (rest/sport days carry no session), through the shared static
 * `estimateSessionMinutes`. 0 when the template has no training day with exercises yet,
 * which is the caller's cue to draw no minutes fact at all rather than a „~0 perc" lie.
 */
export function templateSessionMinutes(template: MesoTemplate): number {
  const sessions = (template.days ?? [])
    .filter((d) => !isOffDay(d) && d.exercises.length > 0)
    .map((d) => estimateSessionMinutes(d.exercises))
  if (sessions.length === 0) return 0
  return Math.round(sessions.reduce((a, b) => a + b, 0) / sessions.length)
}

/** One muscle's weekly working-set total across a template's week. */
export interface TemplateMuscleLoad {
  group: string
  label: string
  /** Representative catalog muscle key for the group — feed muscleColor()/MuscleChip. */
  colorMuscle: string
  sets: number
}

/**
 * Working sets per muscle group summed across the template's whole week — what the
 * template page's `.pl-wload` bars draw ("ennyi munkaszettet kap az izom egy héten, ha
 * ebből indítasz"). Built on the shared `daySessionBreakdown`, so the volume rule (exempt
 * posture/plyo work excluded, coarse group mapping) is the ONE the editor already uses,
 * never a second inline sum. Sorted by sets desc, then group name; groups that only carry
 * exempt work (0 counted sets) are dropped — an empty bar says nothing true.
 */
export function templateWeekSets(template: MesoTemplate): TemplateMuscleLoad[] {
  const acc = new Map<string, TemplateMuscleLoad>()
  for (const day of template.days ?? []) {
    for (const row of daySessionBreakdown(day)) {
      const prev = acc.get(row.group)
      if (prev) prev.sets += row.sets
      else acc.set(row.group, { group: row.group, label: row.label, colorMuscle: row.colorMuscle, sets: row.sets })
    }
  }
  return [...acc.values()]
    .filter((r) => r.sets > 0)
    .sort((a, b) => b.sets - a.sets || a.group.localeCompare(b.group))
}
