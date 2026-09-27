// Check-in 2.0 · „Fáj valami?" (prototype `elo/nap.html` `SH.checkin`, `it.kind==='pain'`):
// Nem / Igen; „Nem" answers and advances, „Igen" opens where (front/back figure + the same
// regions as chips, „Egyéb" included — both kept, owner OK) and how much (1–10). „Tovább" waits
// for at least one region AND an intensity.
import type { CSSProperties } from 'react'
import { CheckInScale } from '@/features/today/sheets/checkin/ScaleStep'
import { PAIN_BACK, PAIN_CHIP_ORDER, PAIN_FRONT, PAIN_SILHOUETTE } from '@/features/today/logic/checkinItems'
import { PAIN_REGION_LABEL } from '@/data/today/checkinPlan'
import type { CheckinPainAnswer, PainRegionId } from '@/data/types'

type PainOption = { id: string; label: string }

function PainFigure({ title, dots, regions, onToggle }: {
  title: string; dots: [PainRegionId, number, number][]; regions: PainRegionId[]; onToggle: (r: PainRegionId) => void
}) {
  // The figure is a pointer shortcut; the chips below are the accessible path to the same
  // regions, so the drawing stays out of the accessibility tree (no duplicate buttons).
  return (
    <figure>
      <svg viewBox="0 0 104 196" aria-hidden="true">
        <path className="ck-sil" d={PAIN_SILHOUETTE} />
        {dots.map(([id, x, y]) => (
          <circle
            key={id}
            className={regions.includes(id) ? 'ck-dot on' : 'ck-dot'}
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
      <div className="ck-yn" style={{ '--c': 'var(--dv-rose)' } as CSSProperties}>
        <button type="button" className={value === false ? 'on' : undefined} aria-pressed={value === false} onClick={onNo}>Nem</button>
        <button type="button" className={yes ? 'on' : undefined} aria-pressed={!!yes}
          onClick={() => { if (!yes) onChange({ regions: [], intensity: null }) }}>Igen</button>
      </div>
      {yes && (
        <>
          <span className="ck-mini">Hol fáj? · Többet is választhatsz</span>
          <div className="ck-fig">
            <PainFigure title="ELÖL" dots={PAIN_FRONT} regions={yes.regions} onToggle={toggle} />
            <PainFigure title="HÁTUL" dots={PAIN_BACK} regions={yes.regions} onToggle={toggle} />
          </div>
          <div className="ck-chips" style={{ '--c': 'var(--dv-rose)' } as CSSProperties}>
            {chipIds.map((id) => (
              <button key={id} type="button" className="chip" aria-pressed={yes.regions.includes(id)} onClick={() => toggle(id)}>
                {labelOf(id)}
              </button>
            ))}
          </div>
          <span className="ck-mini">Mennyire fáj · {yes.intensity ? `${yes.intensity} / 10` : 'koppints'}</span>
          <CheckInScale value={yes.intensity} color="var(--dv-rose)" low={low} high={high}
            onPick={(n) => onChange({ ...yes, intensity: n })} />
          <button type="button" className="cta-primary ck-next" style={{ '--c': 'var(--dv-rose)' } as CSSProperties}
            disabled={!(yes.regions.length > 0 && yes.intensity)} onClick={onNext}>
            Tovább <span aria-hidden="true">›</span>
          </button>
        </>
      )}
    </>
  )
}
