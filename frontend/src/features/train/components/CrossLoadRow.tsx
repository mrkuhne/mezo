// ============================================================
// Mezo · CrossLoadRow — one cross-system impact row inside the SportPage
// Cross-load glass card. Üveg re-dress (mezo-me75u.4, prototype
// uveg-edzes-body.html `sport('cross')` `.xl .lines`): a FLAT row (it sits inside
// the lavender glass — never glass in glass) with the system's Titanium 3D icon,
// the uppercase system label, the affected target, the impact readout and the
// reasoning. A warning row keeps its amber meaning: an amber-tinted flat cell
// with a 2px amber inset edge. Ported from prototype sport.jsx CrossLoadRow.
// ============================================================
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { SYSTEM_LABELS } from '@/data/train/train'
import type { CrossLoadRow as CrossLoadRowData } from '@/data/types'

/** The cross-load system → its 3D glyph (the line-icon names in SYSTEM_LABELS stay for
 *  other surfaces). An unknown system falls back to the info glyph. */
const SYSTEM_ART: Record<string, Icon3DName> = {
  Train: 't-dumbbell', Fuel: 't-plate', Sleep: 't-sleep', Weight: 't-weight', Insights: 't-pattern',
}

interface CrossLoadRowProps {
  item: CrossLoadRowData
}

export function CrossLoadRow({ item }: CrossLoadRowProps) {
  const label = SYSTEM_LABELS[item.system]?.label ?? item.system
  return (
    <div className={item.warning ? 'uvs-xrow is-warn' : 'uvs-xrow'}>
      <Icon3D name={SYSTEM_ART[item.system] ?? 't-info'} size={26} />
      <div className="uvs-xrow-body">
        <div className="uvs-xrow-top">
          <span className="uvs-xrow-sys">{label.toUpperCase()}</span>
          <span className="uvs-xrow-imp">{item.impact}</span>
        </div>
        <strong>{item.target}</strong>
        <p>{item.why}</p>
      </div>
    </div>
  )
}
