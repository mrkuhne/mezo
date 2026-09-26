// ============================================================
// Mezo · GlycemicGlass — a vércukor-válasz üvegdoboza (Fuel Titanium, mezo-6mi43)
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/food.js
// `glucoseView` (:107) + `glucoseCurve` (:62) + `glucoseExpectHtml` (:105), a food.css
// `.fcer-glu*` blokkjaival. Anatómia: üveg-hero (a SÁV SZAVA a nagy „numerál") → sáv-pilula →
// a stilizált válasz-görbe → a tányér négy ténye → mit érzel majd (energia · alapszint · éhség)
// → egy tipp → lábjegyzet. A számok és a mondatok a `glycemicBand` deriválásából jönnek, ami a
// prototípus `glycemicFor`-ját viszi tovább szó szerint.
//
// HÁROM DOLOG, AMIT EGY KÉSŐBBI MENET MEG FOG AKARNI „JAVÍTANI" — NE:
//  1. Nincs glikémiás index. Se a szó, se szám. A doboz a SÁV SZAVÁT mutatja nagyban, mert a
//     vegyes étkezés GI-matematikája 22-50%-ot téved (owner-döntés, kétszer megerősítve). A
//     felület szava „vércukor-válasz".
//  2. A „magas" sáv nem kudarc: nincs piros hibaállapot, nincs hibáztató mondat. A színt a
//     `lvl-*` osztály adja, ami hangulat, nem érdemjegy.
//  3. Ha a cukor becsült (`sugarEstimated`), a doboz KIMONDJA. Feltevést mért adatként
//     bemutatni tilos — ez a ház őszinte-null szabálya.
//
// NEM natív <dialog>: a `showModal()` a böngésző TOP LAYER-jébe teszi az elemet, ami az ABLAKHOZ
// méreteződik, nem a telefon-kerethez — élesben ez 641 px-es dobozt adott egy 416 px-es telefon
// fölé. A `GlassBox` a `.phone-screen`-be portáloz; a részleteket az ő fejléce írja le.
//
// Csökkentett mozgás: a görbe önrajzolása CSAK a `is-draw` osztállyal indul, amit a
// `useReducedMotion` kapuz — a CSS `reduce` ága pedig külön is kivezeti.
// ============================================================
import { useId } from 'react'
import { ContentIcon } from '@/shared/ui/clay'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { GlassBox } from '@/features/fuel/components/GlassBox'
import type { GlycemicBand, GlycemicLevel } from '@/features/fuel/logic/glycemicBand'

/** A prototípus három görbéje, 1:1 (food.js `glucoseCurve`, :62). */
export const CURVE: Record<GlycemicLevel, { path: string; peak: [number, number]; note: string }> = {
  high: {
    path: 'M8 78C46 76 62 14 90 12 112 11 122 52 142 82 160 106 208 90 232 84',
    peak: [90, 12],
    note: 'csúcs',
  },
  mid: {
    path: 'M8 78C50 76 76 42 116 40 158 40 190 68 232 78',
    peak: [116, 40],
    note: 'enyhe emelkedés',
  },
  low: {
    path: 'M8 78C56 76 92 62 128 60 166 60 200 72 232 78',
    peak: [128, 60],
    note: 'lapos domb',
  },
}

/** A doboz címe, a prototípus szavaival (food.js `glucoseView`). */
const HEADLINE: Record<GlycemicLevel, string> = {
  high: 'Ez most megdobja.',
  mid: 'Egy szelídebb domb.',
  low: 'Szépen simít.',
}

/** Az eredménysor sávszava, a `glycemicBand` LABELS-ével azonos. */
const LEVEL_WORD: Record<GlycemicLevel, string> = { low: 'alacsony', mid: 'közepes', high: 'magas' }

const AXIS: [number, string][] = [[8, 'evés'], [82, '+1 ó'], [157, '+2 ó'], [218, '+3 ó']]

/**
 * A görbe ikon-méretben (mezo-ya2wp) — a Mai sor chipje ezt hordja a pontszámtól balra.
 * UGYANAZOK a path-ok, mint a dobozé: a chip a doboz kicsinyített előképe, nem külön rajz.
 * Feliratok és tengely nélkül — ekkora méretben a FORMA a jel, a szöveget a doboz hozza.
 */
export function GlycemicMiniCurve({ level }: { level: GlycemicLevel }) {
  const curve = CURVE[level]
  return (
    <svg className="fmx-glu-mini" viewBox="0 0 240 108" aria-hidden="true">
      <line x1="8" y1="78" x2="232" y2="78" strokeDasharray="3 5" className="fmx-glu-base" />
      <path d={`${curve.path} L232 108 8 108Z`} className="fmx-glu-fill" />
      <path d={curve.path} className="fmx-glu-line" />
      <circle cx={curve.peak[0]} cy={curve.peak[1]} r="5" className="fmx-glu-dot" />
    </svg>
  )
}

export function GlycemicGlass({ band, onClose }: { band: GlycemicBand; onClose: () => void }) {
  const titleId = useId()
  const reduced = useReducedMotion()
  const curve = CURVE[band.level]

  return (
    <GlassBox onClose={onClose} className={`fmx-glu-glass lvl-${band.level}`} labelledBy={titleId}>
      <div className="fmx-glass-hero fmx-glu-hero">
        <span aria-hidden="true"><ContentIcon name="i-vercukor" size={56} /></span>
        <div>
          {/* A SÁV SZAVA áll ott, ahol máshol a nagy szám — szándékosan. */}
          <strong>{band.label}</strong>
          <small id={titleId}>Vércukor-válasz · várható hatás</small>
        </div>
      </div>

      <p className="fmx-glu-headline">{HEADLINE[band.level]}</p>

      <svg
        className={`fmx-glu-curve${reduced ? '' : ' is-draw'}`}
        viewBox="0 0 240 122"
        aria-hidden="true"
      >
        <line x1="8" y1="78" x2="232" y2="78" strokeDasharray="3 5" className="fmx-glu-base" />
        <text x="8" y="72" className="fmx-glu-axis">alapszint</text>
        <path d={`${curve.path} L232 108 8 108Z`} className="fmx-glu-fill" />
        <path d={curve.path} className="fmx-glu-line" />
        <circle cx={curve.peak[0]} cy={curve.peak[1]} r="3.4" className="fmx-glu-dot" />
        <text x={curve.peak[0] + 10} y={Math.max(14, curve.peak[1] - 2)} className="fmx-glu-note">
          {curve.note}
        </text>
        {band.level === 'high' && <text x="150" y="119" className="fmx-glu-note">visszaesés</text>}
        {AXIS.map(([x, label]) => (
          <g key={label}>
            <line x1={x === 8 ? 9 : x} y1="76" x2={x === 8 ? 9 : x} y2="81" className="fmx-glu-tick" />
            <text x={x} y="92" className="fmx-glu-axis">{label}</text>
          </g>
        ))}
      </svg>

      <div className="fmx-glu-facts">
        {band.facts.map(fact => (
          <span key={fact.label}><small>{fact.label}</small><b>{fact.value}</b></span>
        ))}
      </div>

      {band.sugarEstimated && (
        <p className="fmx-glu-estimated">
          A cukor mennyiségét nem tudjuk — a szénhidrát 30%-át vettük finomítottnak. Ez becslés,
          nem mért adat; a sáv ezért is sáv, nem szám.
        </p>
      )}

      <div className="fmx-glu-expect">
        <div>
          <span aria-hidden="true"><ContentIcon name="i-lang" size={26} /></span>
          <span><small>Energia</small><b>{band.expect.energy}</b></span>
        </div>
        <div>
          <span aria-hidden="true"><ContentIcon name="i-idozito" size={26} /></span>
          <span><small>Alapszint</small><b>{band.expect.back}</b></span>
        </div>
        <div>
          <span aria-hidden="true"><ContentIcon name="i-tanyer" size={26} /></span>
          <span><small>Éhség</small><b>{band.expect.hunger}</b></span>
        </div>
      </div>

      <p className="fmx-glu-meaning">
        Minél laposabb a domb, annál egyenletesebb az energiád — a magas, hegyes csúcs gyors
        visszaesést és korai éhséget hoz.
      </p>

      <div className="fmx-glu-tip">
        <span aria-hidden="true"><ContentIcon name="i-noveny" size={30} /></span>
        <span><strong>{band.tip.title}</strong><p>{band.tip.body}</p></span>
      </div>

      {/* „Legközelebb így lesz laposabb" (owner, 2026-09-26): a tipp a MOST-ra szól, ez a
          következő ilyen tányérra. Két csere, és őszintén: melyik sávba vinnék együtt — ha a
          sáv nem vált, azt is kimondjuk, nem ígérünk többet. */}
      {band.improve && (
        <section className="fmx-glu-improve" aria-label="Legközelebb így lesz laposabb">
          <small>Legközelebb így lesz laposabb</small>
          <ol>
            {band.improve.steps.map(step => (
              <li key={step.title}><b>{step.title}</b><p>{step.body}</p></li>
            ))}
          </ol>
          <p className={`fmx-glu-improve-result lvl-${band.improve.result}`}>
            {band.improve.result === band.level
              ? `A kettővel együtt laposabb lesz a domb, de még a ${band.label} sávban marad.`
              : `A kettővel együtt: ${LEVEL_WORD[band.improve.result]} vércukor-válasz.`}
          </p>
        </section>
      )}

      <p className="fmx-glass-note">
        Becslés az étkezés összetételéből, nem mérés és nem orvosi előrejelzés. Sávot mutatunk,
        számot nem: egy vegyes tányér pontos vércukor-csúcsát senki nem tudja kiszámolni.
      </p>
      <button type="button" className="fmx-glass-close" onClick={onClose}>Bezárom</button>
    </GlassBox>
  )
}
