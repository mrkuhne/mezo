// ============================================================
// Mezo · ItemRow — the compact sibling of `ItemCard` (mezo-jyua): a 34px icon
// shield, title + optional subtitle, and either a trailing time or a trailing
// action pill. Three interaction shapes, in priority order:
//   • actionLabel + onAction  → a pill button (the row itself is inert)
//   • onAction only           → the WHOLE row is the button (needs `ariaLabel`)
//   • neither                 → a plain, read-only row
// An `actionLabel` without `onAction` renders as inert copy (e.g. „Még vár"),
// never a dead button. Domain-free: presentation props only.
//
// `linkUrl` adds a FOURTH, orthogonal affordance: a small trailing `↗` link to the
// item's own external content, rendered NEXT TO the action rather than instead of it
// (the retired RoutineCard showed a habit's video link and its `Pipa` side by side).
// A link opts the row out of the whole-row-button shape on purpose — an `<a>` must
// never nest inside a `<button>` (invalid + click-conflicting, the same reason
// RoutineCard gave link-bearing rows their own layout) — so pair a `linkUrl` with an
// `actionLabel` when the row also needs to act.
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { ItemTone } from '@/shared/ui/ItemCard'

export interface ItemRowProps {
  tone: ItemTone
  emoji: string
  title: string
  subtitle?: string | null
  /** Trailing HH:mm; hidden when an action pill is shown. */
  time?: string | null
  actionLabel?: string
  onAction?: () => void
  done?: boolean
  /** Required when the whole row is the button (onAction without actionLabel). */
  ariaLabel?: string
  /** External content to open in a new tab; renders the trailing `↗` link. */
  linkUrl?: string | null
}

export function ItemRow({
  tone, emoji, title, subtitle, time, actionLabel, onAction, done, ariaLabel, linkUrl,
}: ItemRowProps) {
  const pill = Boolean(actionLabel && onAction)
  const rowIsButton = Boolean(onAction) && !pill && !linkUrl
  const body = (
    <>
      <span className="itemrow-ic" aria-hidden="true">{done ? '✓' : emoji}</span>
      <span className="itemrow-tx">
        <span className="itemrow-t1">{title}</span>
        {subtitle ? <span className="itemrow-t2">{subtitle}</span> : null}
      </span>
      {linkUrl ? (
        <a
          className="itemrow-link np-press"
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${title} megnyitása`}
        >
          ↗
        </a>
      ) : null}
      {pill ? (
        <button type="button" className="itemrow-act np-press" onClick={onAction}>{actionLabel}</button>
      ) : actionLabel ? (
        <span className="itemrow-act is-inert">{actionLabel}</span>
      ) : time ? (
        <span className="itemrow-tm">{time}</span>
      ) : null}
    </>
  )
  const cls = cn('itemrow', `itemrow-${tone}`, done && 'is-done')
  return rowIsButton
    ? <button type="button" className={cn(cls, 'np-press')} onClick={onAction} aria-label={ariaLabel}>{body}</button>
    : <div className={cls}>{body}</div>
}
