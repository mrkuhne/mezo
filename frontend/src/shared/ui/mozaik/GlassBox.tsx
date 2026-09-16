// ============================================================
// Mezo · GlassBox — the shared 3D glass primitive (mezo-88iwa.13, T12 Task 2)
// Ports the Titanium companion prototype's `.wo-glass`/`.wo-glass-card`
// (docs/design_2.0/prototypes/companion-titanium/session.css) onto tokens:
// a frosted full-bleed backdrop over the phone frame + a bottom-docked,
// tinted card with a × in the header. Portal target resolution, Escape and
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
  children: ReactNode
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function GlassBox({ open, onClose, label, tint, variant, children }: GlassBoxProps) {
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
  // token, `--ex-color` is what the ported prototype rules inside the glass read (I4).
  const style = tint ? ({ '--gl-tint': tint, '--ex-color': tint } as CSSProperties) : undefined

  return createPortal(
    <>
      <div className={cn('gl-backdrop', anim && 'gl-anim')} onClick={onClose} aria-hidden="true" />
      <div className={cn('gl-card', variant && `is-${variant}`, anim && 'gl-anim')} style={style} role="dialog" aria-modal="true" aria-label={label}>
        <div className="gl-head">
          <strong>{label}</strong>
          <button type="button" className="gl-x" aria-label="Bezárás" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </>,
    target,
  )
}
