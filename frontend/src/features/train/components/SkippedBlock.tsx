import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import { reasonOf, skipEffect, skipLabel } from '@/features/train/logic/skipCopy'

/**
 * What a skipped planned occurrence shows instead of its start CTA (Kihagyás S1, mezo-q4xt2.1 —
 * prototype elo/edzes.html `skBlock()`): the reason's 3D icon (or the skip mark), „Kihagyva ·
 * {reason}", the calm effect line (the free-pass shield when the week's pass covers it), then
 * „Másik ok"/„Okot adok" and „Visszavonom". `inner` is the flat variant for use inside a glass
 * card (never glass in glass); the default wears its own glass (the Today hero). Styles:
 * prototype.css `── Kihagyás S1`.
 */
export function SkippedBlock({ skip, inner, onReason, onUndo }: {
  skip: PlannedSkip
  inner?: boolean
  onReason(): void
  onUndo(): void
}) {
  const reason = skip.source === 'ADVICE' ? undefined : reasonOf(skip)
  return (
    <>
      <div className={cn('trm-skipd', inner ? 'is-in' : 'glass')}>
        <Icon3D name={reason?.icon ?? 't-skip'} size={inner ? 28 : 34} />
        <span>
          <b>Kihagyva · {skipLabel(skip)}</b>
          <small>
            {skip.freePass && skip.source === 'USER' && <Icon3D name="t-shield" size={15} />}
            {skipEffect(skip)}
          </small>
        </span>
      </div>
      <div className="trm-skacts">
        <button type="button" className="trm-skact np-press" onClick={onReason}>
          {reason ? 'Másik ok' : 'Okot adok'}
        </button>
        <button type="button" className="trm-skact np-press" onClick={onUndo}>
          <Icon3D name="t-repeat" size={18} />Visszavonom
        </button>
      </div>
    </>
  )
}
