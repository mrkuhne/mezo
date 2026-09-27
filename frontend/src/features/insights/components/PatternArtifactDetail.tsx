// ============================================================
// Mezo · PatternArtifactDetail — a mentett felismerés (motor-pár és terv nélküli minta, pl. egy
// régi heti AI-feltevés) mélyoldala. Újramesélve (mezo-rstt7, prototypes/src/uveg-minta-body.html
// m6 „Csak megérzés"): ugyanaz a keret nélküli `pmx-hero`, mint a mért mintáké — de pár-sor,
// grafikon és szabály nélkül, mert nincs mit mérni. Kérdés → válasz-szó → mondat → a „MIRE
// ÉPÜLT" idézet → döntés. Alatta lapos panel: amit az app megfigyelt.
// ============================================================
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { SectionHead, patternDecisionButtons, toneClass, type DetailTone } from '@/features/insights/components/DetailHero'
import type { Pattern, PatternRowStatus, PatternStatus } from '@/data/types'
import { patternHeadline, patternPlainLine } from '@/features/insights/logic/patternCopy'
import { cn } from '@/shared/lib/cn'
import { RevokeConfirm } from '@/features/insights/components/PatternAnswerHero'

export interface ArtifactLook {
  word: string
  sentence: string
  tone: DetailTone
  art: Icon3DName
}

const STATUS_META: Record<Exclude<PatternRowStatus, 'proposed' | 'confirmed'>, ArtifactLook> = {
  monitoring: {
    word: 'Megfigyelés alatt',
    sentence: 'Ezt a mintát tovább figyeljük. Még nem épül be tartós tudásként a társ válaszaiba.',
    tone: 'sky',
    art: 't-lens',
  },
  rejected: {
    word: 'Elvetve',
    sentence: 'Ezt a mintát nem használjuk a társ válaszaiban, és nem kérünk róla újabb döntést.',
    tone: 'mute',
    art: 't-skip',
  },
  // Reflexió S2 (mezo-eq85.2) — a motor saját két állapota. Itt csak annyi áll, ami tényszerűen
  // igaz, hogy a felület ne hallgasson el egy létező státuszt.
  refuted: {
    word: 'Megcáfolva',
    sentence: 'Az adat többször egymás után ellentmondott ennek a sejtésnek, ezért az app elengedte.',
    tone: 'mute',
    art: 't-skip',
  },
  dormant: {
    word: 'Szünetel',
    sentence: 'Régóta nincs elég adat ahhoz, hogy ezt tesztelni lehessen. Ha újra lesz, magától felébred.',
    tone: 'mute',
    art: 't-clock',
  },
}

/** A mentett felismerés válasza: amíg dönthető „Mezo sejtése", megerősítve „Csak megérzés"
 *  (a prototípus m6 esete), minden más a saját, tényszerű állapot-mondatát mondja. */
export function artifactLook(pattern: Pattern): ArtifactLook {
  const status = pattern.status ?? 'proposed'
  if (status === 'proposed') {
    return {
      word: 'Mezo sejtése',
      sentence: 'Ez Mezo feltevése. Nincs mögötte mérhető adatpár, ezért nem tudom számolni: te döntöd el, igaz-e rád.',
      tone: 'lav',
      art: 't-bulb',
    }
  }
  if (status === 'confirmed') {
    return {
      word: 'Csak megérzés',
      sentence: 'Ez Mezo korábbi feltevése. Nincs mögötte mérhető adatpár, ezért nem tudom számolni: a te megerősítésed tartja életben.',
      tone: 'lav',
      art: 't-bulb',
    }
  }
  return STATUS_META[status]
}

export function PatternArtifactDetail({
  pattern,
  onDecide,
}: {
  pattern: Pattern
  onDecide: (status: PatternStatus) => void
}) {
  const status = pattern.status ?? 'proposed'
  const look = artifactLook(pattern)

  return (
    <>
      <section className={cn('pmx-hero', 'pmx-hero-artifact', 'rise', toneClass(look.tone))} aria-labelledby="pmx-answer">
        <p className="pmx-q">{patternHeadline(pattern.title)}</p>
        <div className="pmx-ans">
          <Icon3D name={look.art} size={54} />
          <h1 id="pmx-answer">{look.word}</h1>
        </div>
        <p className="pmx-say">{look.sentence}</p>
        <div className="pmx-quote">
          <span className="pmx-eb">MIRE ÉPÜLT</span>
          <p>{patternPlainLine(pattern.mechanism)}</p>
        </div>
        {status === 'proposed' && (
          <div className="pmx-dec">
            <div className="pmx-row2" role="group" aria-label="Döntés a mintáról">
              {patternDecisionButtons((verb) => onDecide(verb)).map((button) => (
                <button key={button.key} type="button" className="pmx-dact" onClick={button.onClick}>
                  <Icon3D name={button.art} size={22} />{button.label}
                </button>
              ))}
            </div>
            <p className="pmx-why">
              <b>Megerősítem</b> — tartós tudás lesz · <b>Figyeljük</b> — marad a listán, de nem tanulok
              belőle · <b>Elvetem</b> — befagy, többé nem hozom elő.
            </p>
          </div>
        )}
        {status === 'confirmed' && (
          <div className="pmx-dec">
            <RevokeConfirm label="Mégsem igaz rám — visszavonom" className="pmx-link" onRevoke={() => onDecide('reject')} />
          </div>
        )}
      </section>

      {pattern.evidence.length > 0 && (
        <>
          <SectionHead title="Mit figyelt meg az app?" meta="mentett minta" />
          <section className="pdt-flat pdt-artifact-card rise">
            <ul className="pdt-artifact-evidence">
              {pattern.evidence.map((item) => <li key={item}><Icon3D name="t-tick" size={18} />{item}</li>)}
            </ul>
          </section>
        </>
      )}
    </>
  )
}
