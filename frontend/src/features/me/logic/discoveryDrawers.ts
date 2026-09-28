// ============================================================
// Heti felfedezések — the drawer logic (mezo-p87ok)
//
// A big week (72 traces before the backend fold, ~34 after) cannot be a flat wall of tiles.
// The rare kinds (life events, memoir, predictions) stay whole on top; the two bulk kinds —
// patterns and new facts — sit in drawers that preview a few rows and expand in place.
// The backend already ranks both lists (patterns: promoted → reinforced → confirmed, newest
// first; facts: newest first), so the preview is simply the head of each list.
// ============================================================
import type { WeeklyReviewDigest } from '@/data/me/weeklyReviewHooks'

/** Rows a closed drawer shows. */
export const DRAWER_PREVIEW_ROWS = 3

/** The latest stagger a rise may get — 40 + 30·n ms put the 72nd tile ~2.2 s in. */
export const MAX_RISE_DELAY_MS = 400

export function riseDelay(index: number): number {
  return Math.min(40 + index * 30, MAX_RISE_DELAY_MS)
}

const EVENT_ORDER = ['promoted', 'reinforced', 'confirmed'] as const
const EVENT_WORD: Record<(typeof EVENT_ORDER)[number], string> = {
  promoted: 'előléptetve',
  reinforced: 'erősödött',
  confirmed: 'megerősítve',
}

/** „14 előléptetve · 4 erősödött · 5 megerősítve" — the patterns drawer's sub-line, biggest
 *  news first; a kind with no pattern is left out, an unknown kind is not counted. */
export function patternBreakdown(patterns: WeeklyReviewDigest['patterns']): string {
  return EVENT_ORDER
    .map((kind) => [kind, patterns.filter((p) => p.event === kind).length] as const)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => `${n} ${EVENT_WORD[kind]}`)
    .join(' · ')
}

/** The rows a drawer renders: the preview head, or everything when open. */
export function drawerRows<T>(items: readonly T[], open: boolean): readonly T[] {
  return open ? items : items.slice(0, DRAWER_PREVIEW_ROWS)
}

/** True when the week has at least one rare trace (life event, memoir, prediction). */
export function hasRareTraces(digest: WeeklyReviewDigest): boolean {
  return digest.lifeEvents.length > 0 || digest.memoir || digest.predictions.length > 0
}
