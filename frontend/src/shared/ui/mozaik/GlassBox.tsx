// ============================================================
// Mezo · GlassBox — the shared 3D glass primitive (mezo-88iwa.13, T12 Task 2)
// Ports the Titanium companion prototype's `.wo-glass`/`.wo-glass-card`
// (docs/design_2.0/prototypes/companion-titanium/session.css) onto tokens:
// a frosted full-bleed backdrop over the phone frame + a bottom-docked,
// tinted card with a × in the header. Portal target resolution, Escape and
// backdrop-click idioms follow Sheet.tsx. Deliberately generic
// (open/onClose/label/tint/children only) — the T6 active-workout slice
// reuses this component unchanged for its confirm/menu surfaces.
// ============================================================
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'

export interface GlassBoxProps {
  open: boolean
  onClose: () => void
  /** Dialog label (aria-label + the header title). */
  label: string
  /** Accent for the card's radial wash + `--gl-tint` readers — defaults to primary coral in CSS. */
  tint?: string
  children: ReactNode
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function GlassBox({ open, onClose, label, tint, children }: GlassBoxProps) {
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
  const style = tint ? ({ '--gl-tint': tint } as CSSProperties) : undefined

  return createPortal(
    <>
      <div className={cn('gl-backdrop', anim && 'gl-anim')} onClick={onClose} aria-hidden="true" />
      <div className={cn('gl-card', anim && 'gl-anim')} style={style} role="dialog" aria-modal="true" aria-label={label}>
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
