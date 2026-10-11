// ============================================================
// Mezo · InfoButton (mezo-b516k, Task 1) — the Train explain layer's ONE primitive.
//
// A text link that opens a short plain-language explanation. Since Folyadék F3
// (mezo-n4wf5.3) it is the prototype's `info()` / `tinfo` pair
// (docs/design_2.0/prototypes/vilagos/edzes.js): the trigger is the kit's text link showing
// the title („Mit mutat a sáv?"), the surface is the kit's `InfoSheet` — a light bottom sheet
// with the info bubble, the title and the copy (plus `children`: a level, a note — whatever
// the explanation draws). The round ⓘ chip of the glass era and its `.pl-info` class left
// with the approved prototype; the kit's `Lk` owns the 44px touch area.
//
// What this component owns on top of the sheet:
//
//   1. the trigger's aria-label, `"<title> — mit jelent?"` (tests of eight pages find it
//      by that name);
//   2. ROUTE-CHANGE close. The sheet listens for Escape / backdrop / × only, so an open
//      one would otherwise survive a client-side navigation and hang over the next screen.
//
// The copy is owner-iterated and ships word for word; call sites pass it verbatim (one
// placement interpolates a real MEV value — never a literal).
// ============================================================
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { Icon3DName } from '@/shared/ui/clay'
import { InfoSheet, Lk } from '@/shared/ui/folyadek'

export interface InfoButtonProps {
  title: string
  /** The owner-iterated explanation, word for word. May contain an interpolated value. */
  copy: string
  /** The Folyadék-jel in the sheet's bubble (default `t-info`). */
  icon?: Icon3DName
  /** The sheet's small context line (the card or section the link belongs to). */
  eyebrow?: string
  /** Drawn in the sheet under the copy (the number the explanation is about, as a level). */
  children?: ReactNode
}

export function InfoButton({ title, copy, icon, eyebrow, children }: InfoButtonProps) {
  const [open, setOpen] = useState(false)
  const { pathname, search, hash } = useLocation()
  const route = `${pathname}${search}${hash}`

  // Keyed on the whole location string (not the object identity, which react-router may
  // recreate) so it fires on a real navigation and not on every render.
  useEffect(() => {
    setOpen(false)
  }, [route])

  return (
    <>
      <Lk className="ex-info-lk" aria-label={`${title} — mit jelent?`} onClick={() => setOpen(true)}>{title}</Lk>
      {open && <InfoSheet title={title} eyebrow={eyebrow} copy={copy} icon={icon} onClose={() => setOpen(false)}>{children}</InfoSheet>}
    </>
  )
}
