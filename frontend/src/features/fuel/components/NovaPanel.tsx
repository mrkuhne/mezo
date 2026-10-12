// ============================================================
// Mezo · NovaPanel (feldolgozottság · NOVA dimenzió tényei a `dim` lapon)
// Folyadék F5 (mezo-n4wf5.5): the stack is ONE vessel holding the four groups (`SplitBar`), its key says WHAT is in each
// group („NOVA 1 · csirke, rizs, bab" — server text), and the per-item list stays under it as the receipt.
// ============================================================
import type { NovaDimension } from '@/data/types'
import { useM } from '@/shared/i18n'
import { LineTags, NOVA_COLOR, SplitBar } from '@/features/fuel/components/folyadek'

export function NovaPanel({ dim }: { dim: NovaDimension }) {
  const M = useM()
  const S = M.fuelEtkezes.score
  const n = dim.nova
  const live = n.stack.filter(s => s.pct > 0)
  return (
    <>
      <SplitBar height={18} parts={live.map(s => ({ label: S.novaPart(s.nova, s.label), pct: s.pct, color: NOVA_COLOR[s.nova] }))} />
      <ul className="fe-nvi">
        {n.items.map((it, i) => (
          <li key={i}>
            <span>{it.name}</span>
            <LineTags nova={it.nova} extra={[it.warning ? S.novaWarn : null]} />
          </li>
        ))}
      </ul>
    </>
  )
}
