// ============================================================
// Mezo · WaterLogSheet — the water vial's tap target (mezo-c9t5, keret-hero Task 2). Rides the
// shared `Sheet` primitive; 250/400/500 ml single-select chips or a manual ml input (typing
// a manual value deselects the chip and takes over — "kézi input felülírja"), Mentés logs
// the selected/typed amount via `onLog` then dismisses. The opener owns `useWaterActions`
// (`logWater`) and wires it into `onLog` — this component has no `@/data/*` import.
// Design: docs/superpowers/specs/2026-08-09-fuel-keret-hero-design.md §1.2.
// Folyadék (mezo-n4wf5.5): build target docs/design_2.0/prototypes/vilagos/fuel.js `waterSheet()`. The
// glass shows TODAY's level and, dashed, where the chosen amount would take it; the big number is the
// amount to log. Water is saved with Mentés only (no tap-the-glass-to-add).
// „Visszavonom az utolsót" (new, owner OK 2026-10-12): the undo is session-based and lives in the
// OPENER's `useWaterActions` instance (its stack is per hook instance), so it arrives through the two
// OPTIONAL props `onUndo` + `canUndo`; without them the link is not drawn. The sheet stays open.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { useToast } from '@/shared/ui/ToastProvider'
import { useM } from '@/shared/i18n'
import { fmtNum } from '@/shared/lib/format'
import { Acts, Btn, FoSheetHead, Input, Lk, Pill, Pills } from '@/shared/ui/folyadek'
import { Glass } from '@/features/fuel/components/folyadek'

const CHIP_ML = [250, 400, 500] as const

export function WaterLogSheet({ currentMl, targetMl, onLog, onClose, onUndo, canUndo }: {
  currentMl: number
  targetMl: number
  onLog: (ml: number) => void
  onClose: () => void
  /** `useWaterActions().undoLastWater` of the opener — takes back the last amount logged in this session. */
  onUndo?: () => void
  /** `useWaterActions().canUndo` of the opener. */
  canUndo?: boolean
}) {
  const M = useM()
  const W = M.fuelTanulas.water
  const { show } = useToast()
  const [chip, setChip] = useState<number | null>(null)
  const [manual, setManual] = useState('')

  const manualNum = manual.trim() === '' ? null : Number(manual)
  const manualValid = manualNum != null && Number.isFinite(manualNum) && manualNum > 0
  const selected = manualValid ? (manualNum as number) : chip
  const canSave = selected != null && selected > 0

  const pickChip = (ml: number) => { setChip(ml); setManual('') }
  const editManual = (v: string) => { setManual(v); setChip(null) }

  const save = (close: () => void) => {
    if (selected == null || selected <= 0) return
    onLog(selected)
    close()
  }

  const pct = (ml: number) => (targetMl > 0 ? (ml / targetMl) * 100 : 0)
  const now = fmtNum(currentMl / 1000, 1)
  const goal = fmtNum(targetMl / 1000, 1)

  return (
    <Sheet onClose={onClose} labelledBy="water-log-title" className="fo-sheet ft-water">
      {(close) => (
        <>
          <FoSheetHead icon="t-water" titleId="water-log-title" title={W.title} sub={W.sub} onClose={close} />
          <div className="ft-wat">
            <Glass pct={pct(currentMl)} nextPct={canSave ? Math.min(105, pct(currentMl + selected)) : null} label={W.glassAria(now, goal)} />
            <div>
              <output className="ft-wbig" aria-label={W.amountAria} aria-live="polite">{selected ?? 0}<small>ml</small></output>
              <p>{W.soFar(now, goal)}</p>
            </div>
          </div>
          <Pills className="ft-wch">
            {CHIP_ML.map(ml => <Pill key={ml} on={chip === ml} onClick={() => pickChip(ml)}>{W.chip(ml)}</Pill>)}
          </Pills>
          <div className="ft-wman">
            <Input
              type="number" inputMode="numeric" min={1} placeholder={W.placeholder} aria-label={W.manualAria}
              value={manual} onChange={e => editManual(e.target.value)}
            />
            <span>{W.manual}</span>
          </div>
          <Acts>
            <Btn grow disabled={!canSave} onClick={() => save(close)}>{W.save}</Btn>
            {canUndo && onUndo && <Lk onClick={() => { onUndo(); show({ kind: 'success', text: W.undone }) }}>{W.undo}</Lk>}
          </Acts>
        </>
      )}
    </Sheet>
  )
}
