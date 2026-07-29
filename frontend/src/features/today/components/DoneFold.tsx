// ============================================================
// Mezo · DoneFold — the collapsed „✓ Kész" summary at the foot of every face
// (mezo-j7u4). Completed items leave the open list entirely and land here, so
// the face always reads as „what is left", never as a mixed pile. Ghosts when
// nothing is done yet.
// ============================================================
import { useState } from 'react'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function DoneFold({ items, xp }: { items: TodayItem[]; xp: number }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="donefold">
      <button type="button" className="donefold-hd np-press" onClick={() => setOpen(!open)} aria-expanded={open}>
        {/* No class on the label on purpose: `.donefold-hd` already carries the header's
            typography and the label needs no geometry of its own (the counter is what pushes
            right, via `.donefold-c`'s `margin-left: auto`). It used to emit `donefold-t`, a
            class with no rule anywhere in the stylesheet — an orphan EMITTER, the mirror image
            of the orphan rules this redesign swept out (mezo-mvb4.1). */}
        <span>✓ Kész ma</span>
        <span className="donefold-c">{items.length} tétel · +{xp} XP</span>
        <span className="donefold-ch" aria-hidden="true">{open ? '⌃' : '⌄'}</span>
      </button>
      {open && items.map((it) => (
        <ItemRow key={it.id} tone={it.tone} emoji={it.emoji} title={it.title} subtitle={it.subtitle} done />
      ))}
    </div>
  )
}
