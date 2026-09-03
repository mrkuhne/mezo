// ============================================================
// Mezo · StepFocus — a varázsló 02 lépése: „Mire gyúr ez a blokk?"
// (#page-wizard [data-step="1"]). A tier-sorok maguk a meglévő
// MusclePriorityPicker (változatlan), alatta a heti szett-összegek élő
// strip-je: a tier tényleg a szetszámot vezérli, nem címke.
// ============================================================
import type { Dispatch } from 'react'
import { MusclePriorityPicker } from '@/features/train/components/MusclePriorityPicker'
import { weekTotals } from '@/features/train/logic/mesoPlan'
import { StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import type { WizardAction, WizardState } from '@/features/train/wizard/wizardState'

export function StepFocus({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  const { weekOne, peak } = weekTotals(state.priorities)

  return (
    <EntranceGroup>
      <div className="mz-steptitle">Fókusz</div>
      <p className="mz-steplead">
        Válassz max 2 hangsúlyt — az kapja a legtöbb szettet, és az nő a legmesszebb.
      </p>
      <MusclePriorityPicker
        value={state.priorities}
        onChange={(priorities) => dispatch({ type: 'setPriorities', priorities })}
      />
      <div style={{ marginTop: 11 }}>
        <StatStrip>
          <StatCell value={weekOne} label="szett · 1. hét" />
          <StatCell value={peak} label="szett · csúcshét" />
        </StatStrip>
      </div>
      <div className="mz-coach">
        <span className="dot" aria-hidden="true" />
        <span>
          Emphasize → MEV+2-ről indul, MRV-ig rámpázik · Grow → MEV-ről MAV-ig · Maintain → MEV-en tart.
        </span>
      </div>
    </EntranceGroup>
  )
}
