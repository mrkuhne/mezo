// ============================================================
// Mezo · InfoButton (mezo-b516k, Task 1) — the Train explain layer's ONE primitive.
//
// A small trigger beside a heading that opens a short plain-language explanation. Since
// Folyadék F3 (mezo-n4wf5.3) both halves wear the light look of the prototype's `info()` /
// `tinfo` sheet (docs/design_2.0/prototypes/vilagos/edzes.js): the trigger is a 22px flat
// round chip with the `t-info` glyph (or, with `link`, the kit's text link showing the
// title), and the surface is the kit's `InfoSheet` — a light bottom sheet with the info
// bubble, the title and the copy. The glass (GlassBox) and its fixed tint are gone.
//
// What this component still owns on top of the sheet:
//
//   1. the trigger's aria-label, `"<title> — mit jelent?"` (tests of eight pages find it
//      by that name), and the 44px hit box: `.pl-info::after`, anchored to the glyph's
//      LEADING edge so it never reaches into the heading text (probed in
//      frontend/tests/layout/layout.spec.ts — hence the kept `pl-info` class);
//   2. ROUTE-CHANGE close. The sheet listens for Escape / backdrop / × only, so an open
//      one would otherwise survive a client-side navigation and hang over the next screen.
//
// The copy is owner-iterated and ships word for word; call sites pass it verbatim (one
// placement interpolates a real MEV value — never a literal).
// ============================================================
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ContentIcon, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'
import { InfoSheet, Lk } from '@/shared/ui/folyadek'

/** The default glyph: `t-info`, on the trigger and in the sheet's bubble. */
const DEFAULT_INFO_ICON: Icon3DName = 't-info'

export interface InfoButtonProps {
  title: string
  /** The owner-iterated explanation, word for word. May contain an interpolated value. */
  copy: string
  /** A Folyadék-jel name (default `t-info`) or a clay name mapped through ContentIcon. */
  icon?: ClayIconName | Icon3DName
  /** The sheet's small context line (the card or section the ⓘ belongs to). */
  eyebrow?: string
  /** Show the title as a text link instead of the round ⓘ (the prototype's „Mit mutat a sáv?" links). */
  link?: boolean
}

export function InfoButton({ title, copy, icon = DEFAULT_INFO_ICON, eyebrow, link }: InfoButtonProps) {
  const [open, setOpen] = useState(false)
  const { pathname, search, hash } = useLocation()
  const route = `${pathname}${search}${hash}`

  // Keyed on the whole location string (not the object identity, which react-router may
  // recreate) so it fires on a real navigation and not on every render.
  useEffect(() => {
    setOpen(false)
  }, [route])

  const label = `${title} — mit jelent?`
  return (
    <>
      {link ? (
        <Lk className="ex-info-lk" aria-label={label} onClick={() => setOpen(true)}>{title}</Lk>
      ) : (
        <button type="button" className="pl-info ex-info" aria-label={label} onClick={() => setOpen(true)}>
          <ContentIcon name={icon} size={14} className="icon" />
        </button>
      )}
      {open && (
        <InfoSheet title={title} eyebrow={eyebrow} copy={copy} icon={icon.startsWith('t-') ? (icon as Icon3DName) : DEFAULT_INFO_ICON} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
