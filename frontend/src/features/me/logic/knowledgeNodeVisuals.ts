import type { ClayIconName, Icon3DName } from '@/shared/ui/clay'
import type { MozaikWash } from '@/shared/ui/mozaik'
import type { GraphNodeKind } from '@/data/types'

/**
 * Mozaik re-face (mezo-d20.6.7): per-kind icon/wash/ink for the Tudás "Kapcsolatok"
 * node tiles + their group headers — a single source so the tile (icon+wash) and its
 * CategoryHeader (ink) never drift apart. Grouping loosely follows the prototype's
 * predtile colors (sage = learned regularities, lav = identity/goal, gold = time-boxed).
 */
export const KIND_ICON: Record<GraphNodeKind, ClayIconName> = {
  PATTERN: 'i-minta',
  PREFERENCE: 'i-checkin',
  GOAL: 'i-cel',
  LIFE_EVENT: 'i-nap',
  SEASON: 'i-nap',
  INSIGHT: 'i-injekcio',
  PERSON: 'i-emberek',
}

export const KIND_WASH: Record<GraphNodeKind, MozaikWash> = {
  PATTERN: 'sage',
  PREFERENCE: 'sage',
  GOAL: 'lav',
  LIFE_EVENT: 'gold',
  SEASON: 'gold',
  INSIGHT: 'lav',
  PERSON: 'rose',
}

export const KIND_INK: Record<GraphNodeKind, string> = {
  PATTERN: 'var(--mz-cell-sage-ink)',
  PREFERENCE: 'var(--mz-cell-sage-ink)',
  GOAL: 'var(--mz-cell-lav-ink)',
  LIFE_EVENT: 'var(--mz-cell-gold-ink)',
  SEASON: 'var(--mz-cell-gold-ink)',
  INSIGHT: 'var(--mz-cell-lav-ink)',
  PERSON: 'var(--mz-cell-rose-ink)',
}

/**
 * Üveg (U9 · mezo-me75u.9): the Tudástár's kind → 3D sprite icon + accent. Mapped here, at the
 * kind level, not through `CLAY_TO_3D` — `i-nap` means both a life event (sun) and a season
 * (calendar), and `i-injekcio` reads as a Belátás (bulb) only in this context (bible rule 20).
 */
export const KIND_3D: Record<GraphNodeKind, Icon3DName> = {
  PATTERN: 't-pattern',
  PREFERENCE: 't-checkin',
  GOAL: 't-flag',
  LIFE_EVENT: 't-sun',
  SEASON: 't-calendar',
  INSIGHT: 't-bulb',
  PERSON: 't-people',
}

export const KIND_ACCENT: Record<GraphNodeKind, string> = {
  PATTERN: 'var(--dv-amber)',
  PREFERENCE: 'var(--dv-sage)',
  GOAL: 'var(--dv-coral)',
  LIFE_EVENT: 'var(--dv-sky)',
  SEASON: 'var(--dv-sky)',
  INSIGHT: 'var(--dv-lav)',
  PERSON: 'var(--dv-rose)',
}
