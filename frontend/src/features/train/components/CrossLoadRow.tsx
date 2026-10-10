// ============================================================
// Mezo · CrossLoadRow — one cross-system impact row inside the SportPage
// Keresztrendszer card. Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `sport('cross')`
// `XL` rows): a list row — the system's glyph, the affected target with the system's name
// as a pill (a warning row's pill is the „bad" tone), the reasoning under it, and the
// impact readout on the right.
// ============================================================
import type { Icon3DName } from '@/shared/ui/clay'
import { Row, St } from '@/shared/ui/folyadek'
import { SYSTEM_LABELS } from '@/data/train/train'
import type { CrossLoadRow as CrossLoadRowData } from '@/data/types'

/** The cross-load system → its glyph (the line-icon names in SYSTEM_LABELS stay for
 *  other surfaces). An unknown system falls back to the info glyph. */
const SYSTEM_ART: Record<string, Icon3DName> = {
  Train: 't-dumbbell', Fuel: 't-plate', Sleep: 't-moon', Weight: 't-weight', Insights: 't-pattern',
}

/** The system's name on the pill, in the prototype's words (`SYSTEM_LABELS` still says „Patterns" / „Étkezés" for other surfaces). */
const SYSTEM_NAME: Record<string, string> = { Train: 'Edzés', Fuel: 'Fuel', Sleep: 'Alvás', Weight: 'Súly', Insights: 'Minták' }

interface CrossLoadRowProps {
  item: CrossLoadRowData
}

export function CrossLoadRow({ item }: CrossLoadRowProps) {
  const label = SYSTEM_NAME[item.system] ?? SYSTEM_LABELS[item.system]?.label ?? item.system
  return (
    <Row
      className={item.warning ? 'es-xrow is-warn' : 'es-xrow'}
      icon={SYSTEM_ART[item.system] ?? 't-info'}
      title={<>{item.target} <St tone={item.warning ? 'bad' : 'q'}>{label}</St></>}
      sub={item.why}
      value={item.impact}
    />
  )
}
