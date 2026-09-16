// ============================================================
// Mezo · Plan-library story — pure, React-free.
//
// Two small pieces of read-only narration the T10 library pages need: a closed
// run's "how did it go" stars + sentence (runStars), and a template's "where does
// it stand" counts across every run started from it (templateStory). Neither
// re-derives anything cerScore.ts already owns — runStars halves its stars via
// the shared `starsFor`, so a run's rating always agrees with the ceremony's own.
// ============================================================
import type { Mesocycle } from '@/data/types'
import { starsFor } from './cerScore'

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
  const matches = mesocycles.filter((m) =>
    m.templateId != null
      ? m.templateId === templateId
      : m.title === templateName || m.shortTitle === templateName,
  )
  return {
    activeNow: matches.some((m) => m.status === 'active'),
    plannedCount: matches.filter((m) => m.status === 'planned').length,
    closedCount: matches.filter((m) => m.status === 'archived').length,
  }
}
