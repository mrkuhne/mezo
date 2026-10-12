// ============================================================
// Mezo · ServingToggle (egy adag ↔ egész recept)
// The basis switch of the recipe page's hero, the editor's live total and the Műhely hero.
// `servings` is the real recipe value; the "whole" label echoes it (`short` = the Műhely's
// narrow cell beside the servings stepper: „Egész" alone).
// Folyadék (mezo-n4wf5.5, fuel.js `servSeg`): the kit `Seg`; words in `fuelRecept.basis`.
// ============================================================
import { useM } from '@/shared/i18n'
import { Seg } from '@/shared/ui/folyadek'

export type ServingBasis = 'serving' | 'whole'

export interface ServingToggleProps {
  value: ServingBasis
  servings: number
  onChange: (b: ServingBasis) => void
  /** The whole-recipe segment without the serving count. */
  short?: boolean
}

export function ServingToggle({ value, servings, onChange, short }: ServingToggleProps) {
  const M = useM()
  const B = M.fuelRecept.basis
  return (
    <Seg<ServingBasis> aria-label={B.aria} value={value} onChange={onChange}
      items={[{ key: 'serving', label: B.serving }, { key: 'whole', label: short ? B.wholeShort : B.whole(servings) }]} />
  )
}
