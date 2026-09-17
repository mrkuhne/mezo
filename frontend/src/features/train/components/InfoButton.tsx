// ============================================================
// Mezo · InfoButton (mezo-b516k, Task 1) — the Train explain layer's ONE primitive.
//
// Ports the companion-titanium prototype's `info()` helper (plan-pages.js:130-131,
// load-pages.js:11, gyak-pages.js:11 — the same two lines three times) and the
// `infoGlass()` surface it opens (navigation.js:88-101) onto the shipped GlassBox.
// The prototype's own comment at navigation.js:89 records the owner call of
// 2026-09-15: „Every ⓘ opens the workout-style 3D glass, never the drawer" — and
// GlassBox IS that glass (it ports `.wo-glass`/`.wo-glass-card` from session.css),
// so this component adds nothing to the surface, only the three pieces GlassBox
// leaves to its caller:
//
//   1. the icon-only 22px trigger (`.pl-info`) with the prototype's exact
//      aria-label, `"<title> — mit jelent?"`;
//   2. the prototype's header anatomy GlassBox has no slot for — the leading clay
//      icon + the „MEZO · RÉSZLET" eyebrow — rendered as the glass's first child
//      rather than by widening GlassBox's props (plan §Global Constraints);
//   3. ROUTE-CHANGE close. The prototype auto-closes the info layer on `hashchange`
//      (navigation.js:100); GlassBox listens for Escape/backdrop/✕ only, so an
//      open glass would otherwise survive a client-side navigation and hang over
//      the next screen.
//
// The tint is FIXED at the prototype's `#bca6f1` for every info glass — it is the
// explain layer's identity colour, deliberately NOT the section's own accent
// (the prototype hardcodes it in infoGlass regardless of what opened it).
//
// The copy is owner-iterated and ships word for word from the prototype; call sites
// pass it verbatim (one placement interpolates a real MEV value — never a literal).
// ============================================================
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'

/** The prototype's fixed explain-layer accent (navigation.js:91, `--ex-color:#bca6f1`). */
export const INFO_TINT = '#bca6f1'

/** The prototype asks for `#i-info`, a symbol that exists in NEITHER sprite (verified:
 *  no `id="i-info"` anywhere in docs/design_2.0/assets or clay-icons.svg) — it renders
 *  as an empty <use> there. `i-tudas` is the quietest neutral stand-in in the shipped
 *  set: a titanium card with a purple gem, reading as „knowledge / explanation", and
 *  its purple family already matches this layer's #bca6f1 identity colour. */
const DEFAULT_INFO_ICON: ClayIconName = 'i-tudas'

export interface InfoButtonProps {
  title: string
  /** The owner-iterated explanation, word for word. May contain an interpolated value. */
  copy: string
  icon?: ClayIconName
}

export function InfoButton({ title, copy, icon = DEFAULT_INFO_ICON }: InfoButtonProps) {
  const [open, setOpen] = useState(false)
  const { pathname, search, hash } = useLocation()
  const route = `${pathname}${search}${hash}`

  // The prototype's `hashchange` close, in SPA terms. Keyed on the whole location
  // string (not the object identity, which react-router may recreate) so it fires on
  // a real navigation and not on every render.
  useEffect(() => {
    setOpen(false)
  }, [route])

  return (
    <>
      <button
        type="button"
        className="pl-info"
        aria-label={`${title} — mit jelent?`}
        onClick={() => setOpen(true)}
      >
        <ClayIcon name={icon} size={22} className="icon" />
      </button>
      <GlassBox open={open} onClose={() => setOpen(false)} label={title} tint={INFO_TINT}>
        <header className="pl-info-head">
          <ClayIcon name={icon} size={34} />
          <small>MEZO · RÉSZLET</small>
        </header>
        <p className="pl-info-copy">{copy}</p>
      </GlassBox>
    </>
  )
}
