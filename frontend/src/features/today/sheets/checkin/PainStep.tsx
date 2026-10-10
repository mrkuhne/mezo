// Check-in · „Fáj valami?" (Folyadék, prototype vilagos/nap.js `ckSheet()`, `it.kind==='pain'`):
// Nem / Igen; „Nem" answers and advances, „Igen" opens where (front/back figure + the same
// regions as pills, „Egyéb" included: both kept, owner OK) and how much (the ten vials).
// „Tovább" waits for at least one region AND an intensity.
import { PAIN_BACK, PAIN_CHIP_ORDER, PAIN_FRONT, PAIN_SILHOUETTE } from '@/features/today/logic/checkinItems'
import { PAIN_REGION_LABEL } from '@/data/today/checkinPlan'
import { Btn, Ends, Lab, Pill, Pills, Scale, TwoBtn } from '@/shared/ui/folyadek'
import type { CheckinPainAnswer, PainRegionId } from '@/data/types'

type PainOption = { id: string; label: string }

function PainFigure({ title, dots, regions, onToggle }: {
  title: string; dots: [PainRegionId, number, number][]; regions: PainRegionId[]; onToggle: (r: PainRegionId) => void
}) {
  // The figure is a pointer shortcut; the pills below are the accessible path to the same
  // regions, so the drawing stays out of the accessibility tree (no duplicate buttons).
  return (
    <figure>
      <svg viewBox="0 0 104 196" aria-hidden="true">
        <path className="nck2-sil" d={PAIN_SILHOUETTE} />
        {dots.map(([id, x, y]) => (
          <circle
            key={id}
            className={regions.includes(id) ? 'nck2-dot on' : 'nck2-dot'}
            cx={x} cy={y} r={6.5}
            data-region={id}
            onClick={() => onToggle(id)}
          >
            <title>{PAIN_REGION_LABEL[id]}</title>
          </circle>
        ))}
      </svg>
      <figcaption>{title}</figcaption>
    </figure>
  )
}

export function PainStep({ value, options, low, high, onNo, onChange, onNext }: {
  /** `undefined`/`null` = not answered yet; `false` = „Nem"; object = „Igen". */
  value: CheckinPainAnswer | null | undefined
  options?: PainOption[]
  low?: string
  high?: string
  onNo: () => void
  onChange: (next: CheckinPainAnswer) => void
  onNext: () => void
}) {
  const yes = value ? value : null
  const labelOf = (id: PainRegionId) => options?.find((o) => o.id === id)?.label ?? PAIN_REGION_LABEL[id]
  // prototype order (figure front → back, then Egyéb); any extra server region goes last
  const chipIds = [...PAIN_CHIP_ORDER, ...((options ?? []).map((o) => o.id as PainRegionId)
    .filter((id) => !PAIN_CHIP_ORDER.includes(id)))]
  const toggle = (r: PainRegionId) => {
    if (!yes) return
    const regions = yes.regions.includes(r) ? yes.regions.filter((x) => x !== r) : [...yes.regions, r]
    onChange({ ...yes, regions })
  }
  return (
    <>
      <TwoBtn className="nck2-yn">
        <Btn ghost={value !== false} aria-pressed={value === false} onClick={onNo}>Nem</Btn>
        <Btn ghost={!yes} aria-pressed={!!yes}
          onClick={() => { if (!yes) onChange({ regions: [], intensity: null }) }}>Igen</Btn>
      </TwoBtn>
      {yes && (
        <>
          <Lab>Hol fáj? · többet is választhatsz</Lab>
          <div className="nck2-fig">
            <PainFigure title="ELÖL" dots={PAIN_FRONT} regions={yes.regions} onToggle={toggle} />
            <PainFigure title="HÁTUL" dots={PAIN_BACK} regions={yes.regions} onToggle={toggle} />
          </div>
          <Pills>
            {chipIds.map((id) => (
              <Pill key={id} on={yes.regions.includes(id)} onClick={() => toggle(id)}>{labelOf(id)}</Pill>
            ))}
          </Pills>
          <Lab id="nck2-pain-int">Mennyire fáj · {yes.intensity ? `${yes.intensity} / 10` : 'koppints'}</Lab>
          <Scale value={yes.intensity} aria-labelledby="nck2-pain-int" onPick={(n) => onChange({ ...yes, intensity: n })} />
          <Ends low={low ?? 'Alig'} high={high ?? 'Nagyon'} />
          <Btn wide className="nck2-next" disabled={!(yes.regions.length > 0 && yes.intensity)} onClick={onNext}>Tovább</Btn>
        </>
      )}
    </>
  )
}
