// ============================================================
// Mezo · GlassBox — the shared glass dialog primitive (mezo-88iwa.13, T12 Task 2)
// Originally ported from the Titanium companion prototype's `.wo-glass`/
// `.wo-glass-card`; RE-DRESSED to the restored Mozaik/Clay world in
// mezo-ju4j6.5 (style bible §7.1a — "the Sheet's louder sibling"). Skin only:
// this file's API, props and DOM are unchanged, all of it lives in the
// `glassbox` section of prototype.css. Note there is a SECOND, unrelated
// GlassBox in features/fuel/components (`.fmx-glass*`, centered) — the two are
// deliberately not merged. A frosted full-bleed backdrop over the phone frame
// + a bottom-docked, tinted card with a × in the header. Portal target resolution, Escape and
// backdrop-click idioms follow Sheet.tsx. Deliberately generic
// (open/onClose/label/tint/children only) — the T6 active-workout slice
// reuses this component unchanged for its confirm/menu surfaces.
//
// Geometry (mezo-88iwa.13 fix round 2): backdrop and card are rendered as
// SIBLINGS below, exactly like Sheet.tsx's `.sheet-backdrop` + `.sheet` pair —
// deliberately NOT nesting the card inside the backdrop. Both are taken out
// of normal flow purely via CSS position in prototype.css (`.gl-backdrop`
// `position: absolute; inset: 0`, `.gl-card` `position: absolute; left: 0;
// right: 0; bottom: 0`), anchored to this portal target (`.phone-screen`,
// itself `position: relative`) the same way Sheet's pair is. Previously the
// backdrop was `position: fixed` (frosted the whole browser window instead of
// the phone frame on desktop) and the card was `position: relative` (joined
// normal flow and shrank `.screen-content` by its own height on open,
// measured 812→524px). jsdom can't verify the resulting geometry — see the
// sibling-shape invariant test in GlassBox.test.tsx and verify visually live.
//
// Üvegesítés U10 (mezo-me75u.10, bead mezo-8vfr2): the glass material is the DEFAULT, not an
// opt-in — every caller was migrated in the same slice (bible U8 rule 61: an opt-in leaves
// stragglers). The card wears `.glass.is-still.uv-gb` (skin: the `uveg reteg ablak` block in
// prototype.css): it floats 10px off the left/right/bottom edges, radius 30, `--c` = the caller's
// `tint` (via `--gl-tint`, default coral), sheen off; the header's `art` sits in a lit well, the
// eyebrow in the accent, a flat round ✕. `className` lets a caller scope its own dialog without
// the old `.gl-card:has(> …)` workaround (the session dialogs use `.wos-gbx`). Everything INSIDE
// the card is flat: never pass a `.glass` body (never glass in glass).
// ============================================================
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'

export interface GlassBoxProps {
  open: boolean
  onClose: () => void
  /** Dialog label (aria-label + the header title). */
  label: string
  /** Accent for the card's radial wash + `--gl-tint` readers — defaults to primary coral in CSS.
   *  Also published as `--ex-color` on the card (mezo-88iwa.7 fix wave I4): the ported
   *  `.gl-card .wo-…` rules read `var(--ex-color)`, which the CARD sets in the active-workout
   *  list — but the glass PORTALS out of that subtree, so inside it the variable would
   *  otherwise be empty and every tinted surface rendered white. */
  tint?: string
  /** Optional `.gl-card` modifier — the prototype's two glass-content shapes
   *  (`.gl-card.is-menu` / `.gl-card.is-confirm`, prototype.css). Omitted = no class,
   *  which is what every pre-existing caller (TrainWeekPage) wants. */
  variant?: 'menu' | 'confirm'
  /** Optional leading art rendered in `.gl-head`, before the eyebrow/label pair — the
   *  prototype's `.wo-glass-head` icon slot (session.css:219). Omitted = no icon column,
   *  exactly today's `.gl-head` render (every pre-existing caller). Fix round 1
   *  (mezo-b516k): pulled up from InfoButton's own `.pl-info-head`, which duplicated
   *  this same icon+eyebrow anatomy next to GlassBox instead of inside it. */
  art?: ReactNode
  /** Optional small eyebrow rendered above the `<strong>{label}</strong>` title — the
   *  prototype's „MEZO · RÉSZLET" line. Omitted = the label renders alone, exactly
   *  today's render. */
  eyebrow?: ReactNode
  /** Extra class(es) on the card (`.gl-card`), for a caller that scopes its own dialog
   *  (mezo-8vfr2). The card is always glass; this only adds a hook. */
  className?: string
  children: ReactNode
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function GlassBox({ open, onClose, label, tint, variant, art, eyebrow, className, children }: GlassBoxProps) {
  // Hooks must run on every render regardless of `open` (React's rule), but the
  // PORTAL TARGET itself is resolved below, in the open branch, on every open render —
  // never cached via useState at mount. GlassBox commonly stays mounted with open=false
  // while its host page renders (T6's active-workout slice toggles it open/closed rather
  // than mounting it fresh), and `.phone-screen` may not exist yet the instant THIS
  // component first mounts. Caching `document.body` at that first render — the way a naive
  // `useState(() => document.querySelector('.phone-screen') ?? document.body)` would —
  // pins the portal to <body> forever, even once `.phone-screen` shows up later. Re-querying
  // fresh every time the dialog opens costs nothing (one DOM lookup per open) and is always
  // correct.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const target = document.querySelector('.phone-screen') ?? document.body
  const anim = !prefersReducedMotion()
  // Both names carry the SAME value on purpose — `--gl-tint` is this primitive's own
  // token (the glass reads its `--c` from it), `--ex-color` is what the ported prototype
  // rules inside the glass read (I4).
  const style = tint ? ({ '--gl-tint': tint, '--ex-color': tint } as CSSProperties) : undefined

  return createPortal(
    <>
      <div className={cn('gl-backdrop', anim && 'gl-anim')} onClick={onClose} aria-hidden="true" />
      <div
        className={cn('gl-card glass is-still uv-gb', variant && `is-${variant}`, anim && 'gl-anim', className)}
        style={style} role="dialog" aria-modal="true" aria-label={label}
      >
        <div className="gl-head">
          {art && <span className="gl-art uv-well">{art}</span>}
          <div className="gl-head-title">
            {eyebrow && <small>{eyebrow}</small>}
            <strong>{label}</strong>
          </div>
          <button type="button" className="gl-x" aria-label="Bezárás" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </>,
    target,
  )
}
