// ============================================================
// Mezo · FuelMealCeremony — a naplózást lezáró ünneplés (mezo-bqwyo · jutalomoldalak mezo-p2777).
//
// A MINTA a ceremónia-mintáé (docs/design_2.0/2026-09-15-ceremony-pattern.md): egy koreográfia, pontosan
// egyszer, minden szám prop. Az ANYAG Folyadék (mezo-n4wf5.5, prototípus vilagos/fuel.js `cer()`):
// a címsor („A napod része lett" · az étkezés és az ideje) → a színpad: öt csillag egy KEHELY fölött, ami
// Mezo értékeléséig telik, benne a pontszám → az ítélet → „Ez került a napodba": kcal és a három makró →
// a két kiút (Vissza a naphoz · Részletek).
//
// A menet a kit EGY rAF-menete (`useCeremonyPass`): az írja a `--p`-t, a csillagok osztályait, a számlálókat
// és az ütemeket — CSS-átmenet nem viszi (egy háttérbe tett webview a frissen indított átmenetet a
// kezdőértéken fagyasztja). Csökkentett mozgásnál nincs menet: az első render a végállapot.
//
// EGY szám, EGY kerekítés (biblia F4.8): a kiírt csillagszám, az égő csillagok és az ítélet ugyanabból a
// `mealStars`-ból jönnek — a menet ezért `csillag / 5`-ig fut, a kehely szintje pedig a pontszám maga
// (`--k` = a pontszám aránya a menet végéhez). Minden szám PROP: ez a komponens nem számol és nem talál ki
// semmit. Pontszám nélkül a hívó meg sem nyitja (őszinte-null).
// ============================================================
import { useEffect, useId, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useM } from '@/shared/i18n'
import { fmtFixed } from '@/shared/lib/format'
import { Icon3D } from '@/shared/ui/clay'
import {
  Btn, Card, CeremonyCount, CeremonyReveal, CeremonyRoot, Facts, Page, Section, TitleRow, useCeremonyPass,
} from '@/shared/ui/folyadek'
import { mealStars, mealVerdict } from '@/features/fuel/logic/mealCeremony'

export interface FuelMealCeremonyProps {
  /** A ház 0..10-es skáláján — a hívó fordítja a drót 0..1-éből (`scoreOutOfTen`). */
  scoreOutOfTen: number
  /** Az étkezés neve (vagy a sávja, ha nincs neve) és az ideje — a címsor kontextus-sora. */
  mealLabel: string
  timeLabel: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  /** A kiút: vissza a naphoz. */
  onClose(): void
  /** A mélyebb felület: az étkezés saját értékelő lapja. Elhagyható (nincs mindig pontlap). */
  onDetails?: () => void
  /** Teszt-varrat; alapból a `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}

const STAR_SLOTS = [0, 1, 2, 3, 4]
/** The cup (prototype `CERCUP`) and its liquid's wavy surface, wide enough to drift. */
const CUP = 'M24 14 H176 V62 C176 100 144 122 100 122 C56 122 24 100 24 62Z'
const SURFACE = `M-120 14${' q10 -5 20 0 q10 5 20 0'.repeat(11)} V140 H-120Z`

export function FuelMealCeremony({
  scoreOutOfTen, mealLabel, timeLabel, kcal, proteinG, carbsG, fatG, onClose, onDetails, reducedMotion,
}: FuelMealCeremonyProps) {
  const M = useM()
  const C = M.fuelLog.cer
  const stars = mealStars(scoreOutOfTen)
  const pass = useCeremonyPass({ ratio: stars / 5, reducedMotion })
  const headingRef = useRef<HTMLHeadingElement>(null)
  const cid = `fg-cup-${useId().replace(/:/g, '')}`

  // The cup fills to the score itself (8,3 → 83%), while the pass runs to the lit stars' share.
  const level = Math.max(0, Math.min(1, scoreOutOfTen / 10))
  const y = 122 - 108 * level
  const score = fmtFixed(scoreOutOfTen, 1)

  // A bejelentés a képernyő kezdete — képernyőolvasónak és billentyűzetnek egyaránt.
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }) }, [])

  return (
    <div className="fg-cers" role="dialog" aria-modal="true" aria-label={C.dialog}>
      <Page
        nonav className="fg-cer-page"
        foot={(
          <>
            <Btn ghost grow={!onDetails} onClick={onClose}>{C.back}</Btn>
            {onDetails && <Btn grow onClick={onDetails}>{C.details}</Btn>}
          </>
        )}
      >
        <TitleRow context={C.context(mealLabel, timeLabel)} title={C.title} backLabel={C.close} onBack={onClose} headingRef={headingRef} />
        <CeremonyRoot pass={pass} className="fg-cer">
          <section
            className="fo-card fo-hero fg-stage" data-cer-stage=""
            style={{ '--p': String(pass.told ? pass.ratio : 0), '--k': String(level / (stars / 5)) } as CSSProperties}
          >
            <span className="fo-hero-lbl">{C.stars(stars)}</span>
            <div className="fg-cst" aria-hidden="true">
              {STAR_SLOTS.map((i) => (
                <i key={i} data-cer-star={i} className={pass.told && i < stars ? 'is-lit' : undefined}>
                  <Icon3D name="t-star-empty" size={34} className="off" />
                  <Icon3D name="t-star" size={34} className="on" />
                </i>
              ))}
            </div>
            <div className="fg-cup" role="img" aria-label={C.cupAria(score)}>
              <svg viewBox="0 0 200 132" aria-hidden="true">
                <defs>
                  <clipPath id={cid}><path d={CUP} /></clipPath>
                  <linearGradient id={`${cid}g`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--liq1)" /><stop offset="1" stopColor="var(--liq2)" />
                  </linearGradient>
                </defs>
                <path d={CUP} fill="#fff" stroke="rgba(10,42,60,.12)" strokeWidth="2.5" />
                <g clipPath={`url(#${cid})`}>
                  <g className="lq"><path className="wvp" fill={`url(#${cid}g)`} d={SURFACE} /></g>
                  {[0.4, 0.6, 0.8].map((t) => <path key={t} d={`M152 ${14 + 108 * (1 - t)}h14`} stroke="rgba(10,42,60,.28)" strokeWidth="2" strokeLinecap="round" />)}
                  <path d="M40 26 V58" stroke="rgba(255,255,255,.8)" strokeWidth="6" strokeLinecap="round" />
                </g>
                <text x="100" y={Math.max(84, y + 38)} textAnchor="middle" className="n">{score}</text>
              </svg>
              <small>{C.rating}</small>
            </div>
            <CeremonyReveal beat={1}><p className="fo-hero-verdict">{mealVerdict(stars)}</p></CeremonyReveal>
          </section>

          <CeremonyReveal beat={2}>
            <Section n={1} title={C.into} />
            <Card className="fg-cfc">
              <Facts items={[
                [<CeremonyCount key="k" pass={pass} value={kcal} />, C.kcal],
                [<CeremonyCount key="p" pass={pass} value={proteinG} />, C.protein],
                [<CeremonyCount key="c" pass={pass} value={carbsG} />, C.carbs],
                [<CeremonyCount key="f" pass={pass} value={fatG} />, C.fat],
              ]} />
            </Card>
          </CeremonyReveal>
        </CeremonyRoot>
      </Page>
    </div>
  )
}
