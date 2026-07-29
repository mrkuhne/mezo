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
// Two orthogonal modifiers sit on top of those shapes:
//   • `linkUrl` — a small trailing `↗` to the item's own external content, rendered
//     NEXT TO the action, never instead of it (the retired RoutineCard showed a
//     habit's video link and its `Pipa` side by side). The link is never nested
//     INSIDE the row's own <button> (invalid + click-conflicting, the same reason
//     RoutineCard gave link-bearing rows their own layout): in the whole-row-button
//     shape the hit area becomes an inner button and the link its sibling, so the
//     action is never silently dropped.
//   • `disabled` — an in-flight write. The control is WITHDRAWN rather than dimmed
//     (the WindDownBanner pattern): a labelled action falls back to its own inert
//     copy, an unlabelled one leaves a plain row. Nothing stays clickable, so a
//     double-tap cannot fire a second mutation.
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
  /** An in-flight write — withdraws every interactive control on the row. */
  disabled?: boolean
}

export function ItemRow({
  tone, emoji, title, subtitle, time, actionLabel, onAction, done, ariaLabel, linkUrl, disabled,
}: ItemRowProps) {
  const live = Boolean(onAction) && !disabled
  const pill = Boolean(actionLabel) && live
  const rowIsButton = live && !pill

  const core = (
    <>
      <span className="itemrow-ic" aria-hidden="true">{done ? '✓' : emoji}</span>
      <span className="itemrow-tx">
        <span className="itemrow-t1">{title}</span>
        {subtitle ? <span className="itemrow-t2">{subtitle}</span> : null}
      </span>
    </>
  )
  const link = linkUrl ? (
    <a
      className="itemrow-link np-press"
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${title} megnyitása`}
    >
      ↗
    </a>
  ) : null
  const trailing = pill ? (
    <button type="button" className="itemrow-act np-press" onClick={onAction}>{actionLabel}</button>
  ) : actionLabel ? (
    <span className="itemrow-act is-inert">{actionLabel}</span>
  ) : time ? (
    <span className="itemrow-tm">{time}</span>
  ) : null

  const cls = cn('itemrow', `itemrow-${tone}`, done && 'is-done')
  if (rowIsButton) {
    return link ? (
      <div className={cls}>
        <button type="button" className="itemrow-hit np-press" onClick={onAction} aria-label={ariaLabel}>
          {core}{trailing}
        </button>
        {link}
      </div>
    ) : (
      <button type="button" className={cn(cls, 'np-press')} onClick={onAction} aria-label={ariaLabel}>
        {core}{trailing}
      </button>
    )
  }
  return <div className={cls}>{core}{link}{trailing}</div>
}
