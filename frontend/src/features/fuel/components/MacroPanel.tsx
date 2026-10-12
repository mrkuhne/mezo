// ============================================================
// Mezo · MacroPanel (a makró-dimenzió tényei a `dim` lapon)
// Folyadék F5 (mezo-n4wf5.5): the three `.sb-tgrow` bars became the prototype's `kv` tiles — one per macro, each with the
// meal's OWN share and the rubric band it is measured against („31% · cél 25–35%").
//
// The „cél" is the DIMENSION's own rubric band (mezo-jcpt.1), not the day's budget (which mezo-tjua removed from here).
// „Honnan a cél" (`targetOrigin`) is not in the approved prototype and is left out on purpose (plan § Wording).
// ============================================================
import type { MacroDimension } from '@/data/types'
import { useM } from '@/shared/i18n'
import { fmtNum } from '@/shared/lib/format'
import { Note } from '@/shared/ui/folyadek'
import { Kv } from '@/features/fuel/components/folyadek'

export function MacroPanel({ dim }: { dim: MacroDimension }) {
  const M = useM()
  const S = M.fuelEtkezes.score
  const K = M.fuelKozos.macro
  const r = dim.macroRatio
  return (
    <>
      <Kv items={[
        [K.protein, S.macroRow(r.p, dim.macroTargets.p)],
        [K.carbs, S.macroRow(r.c, dim.macroTargets.c)],
        [K.fat, S.macroRow(r.f, dim.macroTargets.f)],
      ]} />
      <Note>{S.macroFrame(fmtNum(dim.kcalShareOfDay))}</Note>
      {/* server text (a scoring remark), shown as it arrives */}
      {dim.notes && <Note tone="warn">{dim.notes}</Note>}
    </>
  )
}
