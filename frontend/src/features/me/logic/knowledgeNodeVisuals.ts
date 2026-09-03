import type { ClayIconName } from '@/shared/ui/clay'
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
