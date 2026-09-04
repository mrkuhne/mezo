import { Icon, type IconName } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { PatternDecisionCard } from '@/features/insights/components/PatternDecisionCard'
import type { Pattern, PatternRowStatus, PatternStatus } from '@/data/types'

const STATUS_META: Record<Exclude<PatternRowStatus, 'proposed'>, {
  label: string
  copy: string
  icon: IconName
  skin: string
}> = {
  monitoring: {
    label: 'Megfigyelés alatt',
    copy: 'Ezt a mintát tovább figyeljük. Még nem épül be tartós tudásként a társ válaszaiba.',
    icon: 'eye',
    skin: 'pdt-artifact-monitoring',
  },
  confirmed: {
    label: 'Megerősítve',
    copy: 'A társ figyelembe veszi ezt a mintát a beszélgetésekben és a későbbi előrejelzéseknél.',
    icon: 'check',
    skin: 'pdt-artifact-confirmed',
  },
  rejected: {
    label: 'Elvetve',
    copy: 'Ezt a mintát nem használjuk a társ válaszaiban, és nem kérünk róla újabb döntést.',
    icon: 'x',
    skin: 'pdt-artifact-rejected',
  },
}

export function PatternArtifactDetail({
  pattern,
  onDecide,
}: {
  pattern: Pattern
  onDecide: (status: PatternStatus) => void
}) {
  const status = pattern.status ?? 'proposed'

  return (
    <>
      {status === 'proposed' ? (
        <PatternDecisionCard pattern={pattern} pair={null} onDecide={onDecide}
          showExplainer titleSize={23} showDetailLink={false} />
      ) : (
        <section className={`pdt-artifact-hero ${STATUS_META[status].skin}`}>
          <div className="pdt-artifact-top">
            <span className="pdt-artifact-icon"><ClayIcon name="i-minta" size={30} /></span>
            <span><small>{pattern.categoryLabel}</small><b>{STATUS_META[status].label}</b></span>
            <Icon name={STATUS_META[status].icon} size={20} />
          </div>
          <h1>{pattern.title}</h1>
          <p>{STATUS_META[status].copy}</p>
        </section>
      )}

      <section className="pdt-card pdt-artifact-card">
        <div className="pdt-section-head"><h2>Mit figyelt meg az app?</h2><span>mentett minta</span></div>
        {status !== 'proposed' && <p className="pdt-artifact-mechanism">{pattern.mechanism}</p>}
        {pattern.evidence.length > 0 && (
          <ul className="pdt-artifact-evidence">
            {pattern.evidence.map((item) => <li key={item}><Icon name="check" size={14} />{item}</li>)}
          </ul>
        )}
      </section>

      <p className="pdt-note pdt-artifact-note">
        Ez egy mentett felismerés. Nincs hozzá külön motor-pár és napgrafikon, ezért itt csak azt mutatjuk,
        amit a minta ténylegesen tartalmaz.
      </p>
    </>
  )
}
