// ============================================================
// Mezo · InfoButton (mezo-b516k, Task 1) — the Train explain layer's ONE primitive.
//
// Ports the companion-titanium prototype's `info()` helper (plan-pages.js:130-131,
// load-pages.js:11, gyak-pages.js:11 — the same two lines three times) and the
// `infoGlass()` surface it opens (navigation.js:88-101) onto the shipped GlassBox.
// The prototype's own comment at navigation.js:89 records the owner call of
// 2026-09-15: „Every ⓘ opens the workout-style 3D glass, never the drawer" — and
// GlassBox IS that glass (it ports `.wo-glass`/`.wo-glass-card` from session.css),
// so this component adds nothing to the surface, only the two pieces GlassBox
// leaves to its caller:
//
//   1. the icon-only 22px trigger (`.pl-info`) with the prototype's exact
//      aria-label, `"<title> — mit jelent?"`;
//   2. ROUTE-CHANGE close. The prototype auto-closes the info layer on `hashchange`
//      (navigation.js:100); GlassBox listens for Escape/backdrop/✕ only, so an
//      open glass would otherwise survive a client-side navigation and hang over
//      the next screen.
//
// The prototype's header anatomy — the leading clay icon + the „MEZO · RÉSZLET"
// eyebrow (`.wo-glass-head`, session.css:219) — is fix round 1 (mezo-b516k): it now
// goes through GlassBox's own `art`/`eyebrow` props rather than a separate
// `.pl-info-head` block InfoButton stacked next to GlassBox's header. GlassBox's
// `.gl-head` is the prototype's ONE glass header every glass shares.
//
// The tint is FIXED for every info glass. It was the Titanium prototype's `#bca6f1`; the
// üveg re-dress (U10, mezo-me75u.10, prototypes/src/uveg-reteg-body.html `GB.info`) gives
// the shared dialog its AREA's colour, and every InfoButton lives in Edzés: coral. Inside
// the glass the art is the Titanium 3D set. Since U11 (mezo-me75u.11) the trigger is 3D too:
// the default is `t-info`, so every InfoButton trigger in the app wears the 3D set.
//
// The copy is owner-iterated and ships word for word from the prototype; call sites
// pass it verbatim (one placement interpolates a real MEV value — never a literal).
// ============================================================
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import { ContentIcon, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'

/** The explain layer's fixed accent: Edzés coral (üveg U10; was the Titanium `#bca6f1`). */
export const INFO_TINT = 'var(--dv-coral)'

/** The default trigger glyph: the Titanium 3D `t-info` (U11, mezo-me75u.11 — the clay
 *  `i-info` was the last clay glyph on every info trigger). */
const DEFAULT_INFO_ICON: Icon3DName = 't-info'

export interface InfoButtonProps {
  title: string
  /** The owner-iterated explanation, word for word. May contain an interpolated value. */
  copy: string
  /** A Titanium 3D name (default `t-info`) or a clay name mapped through ContentIcon. */
  icon?: ClayIconName | Icon3DName
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
        <ContentIcon name={icon} size={22} className="icon" />
      </button>
      <GlassBox
        open={open}
        onClose={() => setOpen(false)}
        label={title}
        tint={INFO_TINT}
        art={<ContentIcon name={icon} size={30} />}
        eyebrow="MEZO · RÉSZLET"
      >
        <p className="pl-info-copy">{copy}</p>
      </GlassBox>
    </>
  )
}
