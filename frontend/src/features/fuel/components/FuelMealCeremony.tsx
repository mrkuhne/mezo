// ============================================================
// Mezo · FuelMealCeremony — a naplózást lezáró ünneplés (mezo-bqwyo).
//
// A tulajdonos 2026-09-18: „volt egy nagyon szépen kidolgozott reward screen az edzés
// végénél… ezt be akartam tenni a kajához is". A kaja-ceremónia eddig CSAK a prototípusban
// létezett (companion-titanium/food.js `fcer-`, mezo-6z0ai); ez a produkciós párja.
//
// Minta: docs/design_2.0/2026-09-15-ceremony-pattern.md — a ceremónia BIRTOKOLJA a képernyőt,
// egy koreográfia fut pontosan egyszer, és egy világos kiút van. Két FELVONÁS egy képernyőn
// (nem két képernyő, mint az edzésnél): (1) gyújtás — ég a kő-sáv, pörögnek a számlálók,
// balról jobbra gyulladnak a csillagok; (2) olvasat — verdikt, étkezés neve/ideje, pontszám.
//
// Anyag: a VISSZAÁLLÍTOTT világ (stíluskönyv §5) — csiszolt kő / arany, nem titán üveg.
//
// Minden szám PROP: ez a komponens nem számol és nem talál ki semmit. Pontszám nélkül a hívó
// meg sem nyitja (őszinte-null: a csillag nem születhet a semmiből).
//
// Mozgás: EGY rAF-menet (cubic ease-out, 2400 ms) írja a `--p`-t, a számlálók szövegét és a
// csillagok osztályait — a CSS-átmenet nem elég, mert egy háttérbe tett webview a frissen
// indított átmenetet 0-n fagyasztja (a nap-sávok tanulsága, minta §Motion). Csökkentett
// mozgásnál nincs menet: az első render már a végállapot.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { ClayIcon } from '@/shared/ui/clay'
import { mealStars, mealVerdict } from '@/features/fuel/logic/mealCeremony'

export interface FuelMealCeremonyProps {
  /** A ház 0..10-es skáláján — a hívó fordítja a drót 0..1-éből (`scoreOutOfTen`). */
  scoreOutOfTen: number
  /** Az étkezés neve (vagy a sávja, ha nincs neve) és az ideje — az olvasat kontextus-sora. */
  mealLabel: string
  timeLabel: string
  kcal: number
  proteinG: number
  carbsG: number
  /** A kiút: vissza a naphoz. */
  onClose(): void
  /** A mélyebb felület: az étkezés saját értékelő lapja. Elhagyható (nincs mindig pontlap). */
  onDetails?: () => void
  /** Teszt-varrat; alapból a `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}

const DURATION_MS = 2400
const STAR_SLOTS = [0, 1, 2, 3, 4]

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** A csillag i akkor gyullad, amikor a menet átlépi az (i+1)/5 küszöböt — félállás alatta .1-ben. */
function starClass(index: number, progressed: number): string {
  const threshold = (index + 1) / 5
  if (progressed >= threshold - 0.001) return 'is-lit'
  if (progressed >= threshold - 0.1) return 'is-half'
  return ''
}

function huNumber(n: number): string {
  return Math.round(n).toLocaleString('hu-HU').replace(/[  ]/g, ' ')
}

/** '8,3' — magyar tizedesvessző, az ICU-adatoktól függetlenül. */
function huScore(score: number): string {
  return score.toFixed(1).replace('.', ',')
}

export function FuelMealCeremony({
  scoreOutOfTen, mealLabel, timeLabel, kcal, proteinG, carbsG, onClose, onDetails, reducedMotion,
}: FuelMealCeremonyProps) {
  const [instant] = useState(() => reducedMotion ?? prefersReducedMotion())
  const [told, setTold] = useState(instant)
  const stageRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const ranRef = useRef(false)

  const stars = mealStars(scoreOutOfTen)
  const ratio = Math.max(0, Math.min(1, scoreOutOfTen / 10))
  // A SÁV a nyers pontszámig fut (8,3 → 83%), a CSILLAGOK viszont a felfelé kerekített
  // darabszámig (8,3 → 5 csillag). Ha mindkettőt a nyers arány hajtaná, egy ötcsillagos
  // tányér ötödik csillaga sosem gyulladna ki — a képernyő mást mondana, mint a fejléc.
  const starRatio = stars / 5

  // A bejelentés a képernyő kezdete — képernyőolvasónak és billentyűzetnek egyaránt.
  useEffect(() => { headingRef.current?.focus() }, [])

  useEffect(() => {
    // Mountonként PONTOSAN egy menet: az őr túlél minden újrarenderelést (és a StrictMode
    // kettős hívását is, ezért a hurok `isConnected`-re áll le, nem cleanupra).
    if (ranRef.current || instant) return
    ranRef.current = true
    const stage = stageRef.current
    if (!stage) return
    const started = performance.now()
    const paint = (progress: number) => {
      stage.style.setProperty('--p', String(progress * ratio))
      const progressed = progress * starRatio
      const counts: Record<string, number> = { kcal, p: proteinG, c: carbsG }
      stage.querySelectorAll<HTMLElement>('[data-fcx-count]').forEach((el) => {
        const field = el.dataset.fcxCount ?? ''
        el.textContent = huNumber((counts[field] ?? 0) * progress)
      })
      stage.querySelectorAll<HTMLElement>('[data-fcx-star]').forEach((star) => {
        const cls = starClass(Number(star.dataset.fcxStar), progressed)
        star.classList.toggle('is-lit', cls === 'is-lit')
        star.classList.toggle('is-half', cls === 'is-half')
      })
    }
    const frame = (now: number) => {
      // A rAF időbélyeg a `started` ELÉ is eshet (az edzés-ceremónia tanulsága), ezért
      // mindkét végén vágunk.
      const t = Math.max(0, Math.min(1, (now - started) / DURATION_MS))
      paint(1 - (1 - t) ** 3)
      if (t < 1 && stage.isConnected) requestAnimationFrame(frame)
      else setTold(true)
    }
    requestAnimationFrame(frame)
  }, [instant, ratio, starRatio, kcal, proteinG, carbsG])

  // Az első festett kocka: nullák, amíg a menet indul — a végértékek, ha a menet landolt
  // (vagy ha menet nincs). A menet alatt React nem nyúl ezekhez a csomópontokhoz.
  const counter = (value: number) => (told ? huNumber(value) : '0')

  return (
    <div className="fcx-screen" role="dialog" aria-modal="true" aria-label="Az étkezésed elkészült">
      <section
        ref={stageRef}
        className={`fcx${told ? ' is-told' : ''}`}
        style={{ '--p': told ? ratio : 0 } as React.CSSProperties}
      >
        <span className="fcx-sky" aria-hidden="true" />
        <span className="fcx-eyebrow">A NAPOD RÉSZE LETT</span>
        <div className="fcx-stars" aria-hidden="true">
          {STAR_SLOTS.map((i) => (
            <i key={i} data-fcx-star={i} className={told ? starClass(i, starRatio) : undefined}>
              <b className="fcx-aura" />
              {/* Ugyanaz a gyújtás-jel, amit az edzés-ceremónia visel (`i-termes`): a háznak
                  nincs csillag-szimbóluma, és a tulajdonos ezt az ábrát ismeri „csillagként". */}
              <ClayIcon name="i-termes" size={38} />
            </i>
          ))}
        </div>
        <div className="fcx-bar" aria-hidden="true">
          <i className="fcx-fill" />
          <span className="fcx-comet" />
        </div>
        <div className="fcx-counters">
          <span>
            <i aria-hidden="true"><ClayIcon name="i-tanyer" size={22} /></i>
            <strong data-fcx-count="kcal">{counter(kcal)}</strong><small>kcal</small>
          </span>
          <span>
            <i aria-hidden="true"><ClayIcon name="i-hus" size={22} /></i>
            <strong data-fcx-count="p">{counter(proteinG)}</strong><small>g fehérje</small>
          </span>
          <span>
            <i aria-hidden="true"><ClayIcon name="i-gabona" size={22} /></i>
            <strong data-fcx-count="c">{counter(carbsG)}</strong><small>g szénhidrát</small>
          </span>
        </div>
      </section>

      <section className={`fcx-result${told ? ' is-told' : ''}`}>
        <h1 className="sr-only" tabIndex={-1} ref={headingRef}>{stars} csillag az ötből</h1>
        <p className="fcx-verdict">{mealVerdict(stars)}</p>
        <p className="fcx-meal">{mealLabel} · {timeLabel}</p>
        <div className="fcx-score">
          <span aria-hidden="true"><ClayIcon name="i-makro" size={26} /></span>
          <span className="fcx-score-copy">
            <span className="fcx-eyebrow">MEZO ÉRTÉKELÉSE</span>
            <strong>{huScore(scoreOutOfTen)}<small> / 10</small></strong>
          </span>
        </div>
      </section>

      <div className="fcx-foot">
        {onDetails && (
          <button type="button" className="fcx-cta" onClick={onDetails}>
            <span className="fcx-cta-art" aria-hidden="true"><ClayIcon name="i-mikro" size={26} /></span>
            <span><strong>Részletek</strong><small>Miből jött ez a pontszám</small></span>
          </button>
        )}
        <button type="button" className="fcx-close" onClick={onClose}>Vissza a naphoz</button>
      </div>
    </div>
  )
}
