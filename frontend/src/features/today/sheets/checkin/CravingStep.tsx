// Check-in 2.0 · „Kívánsz most valamit?" (prototype `elo/nap.html`, `it.kind==='craving'`): the
// 1–10 row; below 4 a tap answers and advances like any scale, from 4 up „Mit kívánsz?" opens
// (édes · sós · zsíros · bármit, multi) with its own „Tovább".
import type { CSSProperties } from 'react'
import { ScaleStep } from '@/features/today/sheets/checkin/ScaleStep'
import { CRAVING_KIND_LABEL } from '@/data/today/checkinPlan'
import type { CheckinCravingAnswer, CravingKindId } from '@/data/types'
import type { Icon3DName } from '@/shared/ui/clay'

/** From this value on the kinds are asked. */
export const CRAVING_KINDS_FROM = 4

export function CravingStep({ icon, color, value, options, low, high, onPick, onKinds, onNext }: {
  icon: Icon3DName
  color: string
  value: CheckinCravingAnswer | null | undefined
  options?: { id: string; label: string }[]
  low?: string
  high?: string
  onPick: (n: number) => void
  onKinds: (kinds: CravingKindId[]) => void
  onNext: () => void
}) {
  const kinds = (options?.map((o) => o.id) ?? Object.keys(CRAVING_KIND_LABEL)) as CravingKindId[]
  const labelOf = (id: CravingKindId) => options?.find((o) => o.id === id)?.label ?? CRAVING_KIND_LABEL[id]
  const picked = value?.kinds ?? []
  return (
    <>
      <ScaleStep icon={icon} color={color} value={value?.value ?? null} low={low} high={high} onPick={onPick} />
      {value && value.value >= CRAVING_KINDS_FROM && (
        <>
          <span className="ck-mini">Mit kívánsz?</span>
          <div className="ck-chips" style={{ '--c': 'var(--dv-rose)' } as CSSProperties}>
            {kinds.map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={picked.includes(k)}
                onClick={() => onKinds(picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k])}>
                {labelOf(k)}
              </button>
            ))}
          </div>
          <button type="button" className="cta-primary ck-next" style={{ '--c': 'var(--dv-rose)' } as CSSProperties} onClick={onNext}>
            Tovább <span aria-hidden="true">›</span>
          </button>
        </>
      )}
    </>
  )
}
