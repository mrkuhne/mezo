// ============================================================
// Heti · „amire épült" horgony-chipek (mezo-d20.6.10)
// The weekly review's `highlights[]` — code-collected, model-SELECTED refs the
// backend has returned since mezo-p2tr and the UI threw away (audit §8). Each
// chip names WHAT the analysis leaned on and jumps to that thing on the Mezo
// tab. Source: en-body.html `reviewCard()`'s `.hlch` row.
//
// The routes are the CURRENT ones: `/mezo/...` (the /insights promotion landed
// in mezo-d20.5.1) — `/insights/...` is only a redirect shim now.
// ============================================================
import type { ClayIconName } from '@/shared/ui/clay'
import type { WeeklyReviewDigest } from '@/data/me/weeklyReviewHooks'

export type HighlightTone = 'lav' | 'gold' | 'sky' | 'rose'

export interface HighlightChip {
  /** The chip's small uppercase kicker — the prototype's `<em>`. */
  kindLabel: string
  label: string
  tone: HighlightTone
  icon: ClayIconName
  /** Where the chip navigates. Never a guess: `null` means we could not resolve a
   *  destination, and the chip renders as a quiet, non-interactive fact. */
  to: string | null
}

const KIND: Record<string, { kindLabel: string; tone: HighlightTone; icon: ClayIconName }> = {
  // Minta — the pattern-pair detail leaf.
  Pattern: { kindLabel: 'Minta', tone: 'lav', icon: 'i-minta' },
  // Tudás — the Tudástár list (the review does not name WHICH fact, only its text).
  Fact: { kindLabel: 'Tudás', tone: 'gold', icon: 'i-tudas' },
  // Életesemény — life-event candidates live on the same Tudástár page.
  LifeEvent: { kindLabel: 'Életesemény', tone: 'sky', icon: 'i-cel' },
  // Emlék — the memoár.
  Memory: { kindLabel: 'Emlék', tone: 'rose', icon: 'i-memoar' },
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * One highlight -> its chip, or `null` for a kind we do not know how to render (the
 * contract documents exactly four; an unknown fifth is dropped rather than shown with a
 * made-up colour and a made-up destination).
 *
 * A `Pattern` highlight carries only a label — the pair key is NOT on the highlight (see
 * the report's gap list). The digest's `patterns[]` for the SAME week does carry
 * `pairKey` + `title`, so a title match resolves the deep link; without a match the chip
 * falls back to the Minták index rather than inventing a key.
 */
export function highlightChip(
  highlight: { kind: string; label: string },
  digest: WeeklyReviewDigest | null,
): HighlightChip | null {
  const meta = KIND[highlight.kind]
  if (!meta) return null
  let to: string | null
  if (highlight.kind === 'Pattern') {
    const match = (digest?.patterns ?? []).find((p) => norm(p.title) === norm(highlight.label))
    to = match ? `/mezo/patterns/${encodeURIComponent(match.pairKey)}` : '/mezo/patterns'
  } else if (highlight.kind === 'Memory') {
    to = '/mezo/memoir'
  } else {
    to = '/mezo/knowledge'
  }
  return { ...meta, label: highlight.label, to }
}

export function highlightChips(
  highlights: readonly { kind: string; label: string }[] | undefined,
  digest: WeeklyReviewDigest | null,
): HighlightChip[] {
  return (highlights ?? [])
    .map((h) => highlightChip(h, digest))
    .filter((c): c is HighlightChip => c !== null)
}
