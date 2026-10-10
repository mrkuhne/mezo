// Check-in · „Kívánsz most valamit?" (Folyadék, prototype vilagos/nap.js `ckSheet()`,
// `it.kind==='craving'`): the ten vials; below 4 a tap answers and advances like any scale, from 4
// up „Mit kívánsz?" opens (édes · sós · zsíros · bármit, multi) with its own „Tovább".
import { ScaleStep } from '@/features/today/sheets/checkin/ScaleStep'
import { CRAVING_KIND_LABEL } from '@/data/today/checkinPlan'
import { Btn, Lab, Pill, Pills } from '@/shared/ui/folyadek'
import type { CheckinCravingAnswer, CravingKindId } from '@/data/types'
import type { Icon3DName } from '@/shared/ui/clay'

/** From this value on the kinds are asked. */
export const CRAVING_KINDS_FROM = 4

export function CravingStep({ icon, value, options, low, high, onPick, onKinds, onNext, labelledBy }: {
  icon: Icon3DName
  value: CheckinCravingAnswer | null | undefined
  options?: { id: string; label: string }[]
  low?: string
  high?: string
  onPick: (n: number) => void
  onKinds: (kinds: CravingKindId[]) => void
  onNext: () => void
  labelledBy?: string
}) {
  const kinds = (options?.map((o) => o.id) ?? Object.keys(CRAVING_KIND_LABEL)) as CravingKindId[]
  const labelOf = (id: CravingKindId) => options?.find((o) => o.id === id)?.label ?? CRAVING_KIND_LABEL[id]
  const picked = value?.kinds ?? []
  return (
    <>
      <ScaleStep icon={icon} value={value?.value ?? null} low={low} high={high} onPick={onPick} labelledBy={labelledBy} />
      {value && value.value >= CRAVING_KINDS_FROM && (
        <>
          <Lab>Mit kívánsz?</Lab>
          <Pills>
            {kinds.map((k) => (
              <Pill key={k} on={picked.includes(k)}
                onClick={() => onKinds(picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k])}>
                {labelOf(k)}
              </Pill>
            ))}
          </Pills>
          <Btn wide className="nck2-next" onClick={onNext}>Tovább</Btn>
        </>
      )}
    </>
  )
}
