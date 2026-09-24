// ============================================================
// Mezo · PatternArtifactDetail — a mentett felismerés (motor-pár nélküli minta) mélyoldala.
// Üvegben (Üvegesítés U8a, mezo-me75u.13): prototypes/uveg-uzenofal.html #minta/mentett(+/<döntés>).
// EGY üveg-hero: amíg dönthető, benne az „Amit eddig látunk", a döntések magyarázata és a három
// döntés; megítélve az állapot és az, mit jelent. Alatta lapos panel: amit az app megfigyelt.
// A lista inbox-kártyája (`PatternDecisionCard`) változatlan — ez a hero csak a részlet-oldalé.
// ============================================================
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import {
  DecisionRow, DetailHero, SectionHead, StatePill, patternDecisionButtons, type DetailTone,
} from '@/features/insights/components/DetailHero'
import type { Pattern, PatternRowStatus, PatternStatus } from '@/data/types'

const STATUS_META: Record<Exclude<PatternRowStatus, 'proposed'>, {
  label: string
  copy: string
  tone: DetailTone
  art: Icon3DName
}> = {
  monitoring: {
    label: 'Megfigyelés alatt',
    copy: 'Ezt a mintát tovább figyeljük. Még nem épül be tartós tudásként a társ válaszaiba.',
    tone: 'sky',
    art: 't-lens',
  },
  confirmed: {
    label: 'Megerősítve',
    copy: 'A társ figyelembe veszi ezt a mintát a beszélgetésekben és a későbbi előrejelzéseknél.',
    tone: 'sage',
    art: 't-tick',
  },
  rejected: {
    label: 'Elvetve',
    copy: 'Ezt a mintát nem használjuk a társ válaszaiban, és nem kérünk róla újabb döntést.',
    tone: 'mute',
    art: 't-skip',
  },
  // Reflexió S2 (mezo-eq85.2) — a motor saját két állapota. Itt csak annyi áll, ami tényszerűen
  // igaz, hogy a felület ne hallgasson el egy létező státuszt.
  refuted: {
    label: 'Megcáfolva',
    copy: 'Az adat többször egymás után ellentmondott ennek a sejtésnek, ezért az app elengedte.',
    tone: 'mute',
    art: 't-skip',
  },
  dormant: {
    label: 'Szünetel',
    copy: 'Régóta nincs elég adat ahhoz, hogy ezt tesztelni lehessen. Ha újra lesz, magától felébred.',
    tone: 'mute',
    art: 't-clock',
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
        <DetailHero tone="lav" art="t-note" eyebrow={pattern.categoryLabel} title={pattern.title}
          pill={<StatePill tone="lav" art="t-score"
            label={pattern.confidence != null ? `bizonyosság ${(pattern.confidence * 100).toFixed(0)}%` : 'tanulom'} />}>
          <div className="pdt-seen">
            <small>Amit eddig látunk</small>
            <p>{pattern.mechanism}</p>
          </div>
          <div className="pdt-xpl">
            <span><b>Megerősítem</b> — tartós tudás lesz: bekerül a Tudástárba és a társ fejébe, előrejelzés
              és kísérlet épülhet rá.</span>
            <span><b>Figyeljük még</b> — marad a listán, a motor tovább számolja, de nem tanulok belőle.</span>
            <span><b>Elvetem</b> — befagy, többé nem hozom elő.</span>
          </div>
          <DecisionRow label="Döntés a mintáról" buttons={patternDecisionButtons((verb) => onDecide(verb))} />
        </DetailHero>
      ) : (
        <DetailHero tone={STATUS_META[status].tone} art="t-note" eyebrow={pattern.categoryLabel} title={pattern.title}
          pill={<StatePill tone={STATUS_META[status].tone} art={STATUS_META[status].art} label={STATUS_META[status].label} />}>
          <p className="pdt-hero-copy">{STATUS_META[status].copy}</p>
        </DetailHero>
      )}

      <SectionHead title="Mit figyelt meg az app?" meta="mentett minta" />
      {(status !== 'proposed' || pattern.evidence.length > 0) && (
        <section className="pdt-flat pdt-artifact-card rise">
          {status !== 'proposed' && <p className="pdt-artifact-mechanism">{pattern.mechanism}</p>}
          {pattern.evidence.length > 0 && (
            <ul className="pdt-artifact-evidence">
              {pattern.evidence.map((item) => <li key={item}><Icon3D name="t-tick" size={18} />{item}</li>)}
            </ul>
          )}
        </section>
      )}

      <p className="pdt-note pdt-artifact-note rise">
        Ez egy mentett felismerés. Nincs hozzá külön motor-pár és napgrafikon, ezért itt csak azt mutatjuk,
        amit a minta ténylegesen tartalmaz.
      </p>
    </>
  )
}
