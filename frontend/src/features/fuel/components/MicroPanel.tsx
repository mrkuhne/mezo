// ============================================================
// Mezo · MicroPanel (rost & mikro dimenzió tényei a `dim` lapon)
// Folyadék F5 (mezo-n4wf5.5): each nutrient is a two-storey row (`ItemRow`) — name · value on top, its level under it in
// the status colour (ok / quiet / warn; never the error colour). The name and the value are SERVER text.
// ============================================================
import type { MicroDimension, MicroStatus } from '@/data/types'
import { Level } from '@/shared/ui/folyadek'
import { ItemRow } from '@/features/fuel/components/folyadek'

const STATUS: Record<MicroStatus, string> = { good: 'var(--fo-ok)', ok: 'var(--fx-water)', low: 'var(--fo-warn)' }

export function MicroPanel({ dim }: { dim: MicroDimension }) {
  return (
    <div className="fe-rows">
      {dim.micros.map((m, i) => (
        <ItemRow key={i} title={m.name} value={m.value}>
          <Level pct={Math.min(100, m.pct)} color={STATUS[m.status]} height={8} />
        </ItemRow>
      ))}
    </div>
  )
}
