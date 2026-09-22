// ============================================================
// Mezo · FuelMealCeremony — a naplózást lezáró ünneplés (mezo-bqwyo · jutalomoldalak mezo-p2777).
//
// A tulajdonos 2026-09-18: „volt egy nagyon szépen kidolgozott reward screen az edzés
// végénél… ezt be akartam tenni a kajához is". 2026-09-22 (jutalomoldalak, spec
// docs/superpowers/specs/2026-09-22-jutalomoldalak-design.md): EGY család, KÉT súlyosztály.
// Az étkezést naponta 3–5-ször rögzíti, ezért ez a KIS pillanat: ~1 mp, alulról felcsúszó
// lap a nap fölött — nem a teljes képernyős, többütemes edzés-ünneplés.
//
// A lap: bal oldalt az étkezés és az öt csillag, jobb oldalt a Mezo pontja egy kő-gyűrűs
// érmén, alatta a verdikt, egy kártyában a kalória · fehérje · szénhidrát · zsír, és a
// két kiút (vissza a naphoz · Részletek). A háttérre koppintás = vissza a naphoz.
//
// Anyag: a VISSZAÁLLÍTOTT világ (stíluskönyv §5) — a gyűrű a meleg, 3-stopos radiális
// „Ritmus" kő, ugyanaz az anyag, amiből az agyag csillag készül.
//
// Minden szám PROP: ez a komponens nem számol és nem talál ki semmit. Pontszám nélkül a hívó
// meg sem nyitja (őszinte-null: a csillag nem születhet a semmiből).
//
// Mozgás: EGY rAF-menet (1000 ms) írja a lap `--rise`-át (felcsúszás, 0–300 ms), a gyújtás
// `--p`-jét (200–950 ms: gyűrű, csillagok, számlálók, pont) és az ütem-osztályokat
// (`is-b1` 550 ms: verdikt + makrók, `is-b2` 850 ms: a gombok). CSS-átmenet egyiknek sem
// elég: egy háttérbe tett webview a frissen indított átmenetet a kezdőértéken fagyasztja —
// itt az a képernyőn KÍVÜL ragadt lapot jelentene. Csökkentett mozgásnál nincs menet: az
// első render már a végállapot.
// ============================================================
import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
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
  fatG: number
  /** A kiút: vissza a naphoz. */
  onClose(): void
  /** A mélyebb felület: az étkezés saját értékelő lapja. Elhagyható (nincs mindig pontlap). */
  onDetails?: () => void
  /** Teszt-varrat; alapból a `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}

const DURATION_MS = 1000
const RISE_MS = 300
const IGNITE = { from: 200, span: 750 } as const
const BEATS = { b1: 550, b2: 850 } as const
const STAR_SLOTS = [0, 1, 2, 3, 4]

const ease = (t: number) => 1 - (1 - t) ** 3

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function huNumber(n: number): string {
  return Math.round(n).toLocaleString('hu-HU').replace(/[  ]/g, ' ')
}

/** '8,3' — magyar tizedesvessző, az ICU-adatoktól függetlenül. */
function huScore(score: number): string {
  return score.toFixed(1).replace('.', ',')
}

export function FuelMealCeremony({
  scoreOutOfTen, mealLabel, timeLabel, kcal, proteinG, carbsG, fatG, onClose, onDetails, reducedMotion,
}: FuelMealCeremonyProps) {
  const [instant] = useState(() => reducedMotion ?? prefersReducedMotion())
  const [told, setTold] = useState(instant)
  const rootRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const ranRef = useRef(false)
  const stoneId = `fcx-stone-${useId().replace(/:/g, '')}`

  const stars = mealStars(scoreOutOfTen)
  // A GYŰRŰ a nyers pontszámig fut (8,3 → 83%), a CSILLAGOK viszont a felfelé kerekített
  // darabszámig (8,3 → 5 csillag) — különben egy ötcsillagos tányér ötödik csillaga sosem
  // gyulladna ki, és a képernyő mást mondana, mint a fejléc.
  const ratio = Math.max(0, Math.min(1, scoreOutOfTen / 10))

  // A bejelentés a képernyő kezdete — képernyőolvasónak és billentyűzetnek egyaránt.
  useEffect(() => { headingRef.current?.focus() }, [])

  useEffect(() => {
    // Mountonként PONTOSAN egy menet: az őr túlél minden újrarenderelést (és a StrictMode
    // kettős hívását is, ezért a hurok `isConnected`-re áll le, nem cleanupra).
    if (ranRef.current || instant) return
    ranRef.current = true
    const root = rootRef.current
    const sheet = sheetRef.current
    if (!root || !sheet) return
    const started = performance.now()
    const counts: Record<string, number> = { kcal, p: proteinG, c: carbsG, f: fatG }
    const paint = (ms: number) => {
      root.style.setProperty('--rise', String(1 - ease(Math.min(1, ms / RISE_MS))))
      const p = ease(Math.max(0, Math.min(1, (ms - IGNITE.from) / IGNITE.span)))
      sheet.style.setProperty('--p', String(p))
      sheet.querySelectorAll<HTMLElement>('[data-fcx-count]').forEach((el) => {
        el.textContent = huNumber((counts[el.dataset.fcxCount ?? ''] ?? 0) * p)
      })
      const score = sheet.querySelector<HTMLElement>('[data-fcx-score]')
      if (score) score.textContent = huScore(scoreOutOfTen * p)
      sheet.querySelectorAll<HTMLElement>('[data-fcx-star]').forEach((star) => {
        star.classList.toggle('is-lit', p * stars >= Number(star.dataset.fcxStar) + 1 - 0.001)
      })
      root.classList.toggle('is-b1', ms >= BEATS.b1)
      root.classList.toggle('is-b2', ms >= BEATS.b2)
    }
    const frame = (now: number) => {
      // A rAF időbélyeg a `started` ELÉ is eshet (az edzés-ceremónia tanulsága), ezért
      // mindkét végén vágunk.
      const ms = Math.max(0, Math.min(DURATION_MS, now - started))
      paint(ms)
      if (ms < DURATION_MS && root.isConnected) requestAnimationFrame(frame)
      else setTold(true)
    }
    requestAnimationFrame(frame)
  }, [instant, stars, scoreOutOfTen, kcal, proteinG, carbsG, fatG])

  // Az első festett kocka: a lap lent, nullák — a végértékek, ha a menet landolt (vagy ha
  // menet nincs). A menet alatt React nem nyúl ezekhez a csomópontokhoz.
  const counter = (value: number) => (told ? huNumber(value) : '0')

  return (
    <div
      ref={rootRef}
      className={`fcx-screen${told ? ' is-b1 is-b2 is-told' : ''}`}
      style={{ '--rise': told ? 0 : 1 } as CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label="Az étkezésed elkészült"
    >
      {/* A háttérre koppintás ugyanaz, mint a „Vissza a naphoz" — egy lap így viselkedik.
          Billentyűzettel a lap saját gombja éri el ugyanezt, ezért ez a réteg néma. */}
      <div className="fcx-scrim" aria-hidden="true" onClick={onClose} />

      <section
        ref={sheetRef}
        className="fcx-sheet"
        style={{ '--p': told ? 1 : 0, '--score': ratio } as CSSProperties}
      >
        <span className="fcx-sky" aria-hidden="true" />
        <span className="fcx-grab" aria-hidden="true" />

        <div className="fcx">
          <div className="fcx-head">
            <span className="fcx-eyebrow">A NAPOD RÉSZE LETT</span>
            <p className="fcx-meal">{mealLabel}</p>
            <span className="fcx-when">{timeLabel}</span>
            <div className="fcx-stars" aria-hidden="true">
              {STAR_SLOTS.map((i) => (
                <i key={i} data-fcx-star={i} className={told && i < stars ? 'is-lit' : undefined}>
                  <b className="fcx-aura" />
                  {/* Ugyanaz a gyújtás-jel, amit az edzés-ceremónia visel (`i-termes`). */}
                  <ClayIcon name="i-termes" size={30} />
                </i>
              ))}
            </div>
          </div>

          {/* A Mezo pontja egy érmén: a kő a gyűrű, a szám a korongon — sosem a kövön. */}
          <div className="fcx-score">
            <span className="fcx-medal">
              <svg className="fcx-ring" viewBox="0 0 92 92" aria-hidden="true">
                <defs>
                  <radialGradient id={stoneId} cx="36%" cy="30%" r="85%">
                    <stop offset="0" stopColor="#FFE9A8" />
                    <stop offset="0.55" stopColor="#E0AC2F" />
                    <stop offset="1" stopColor="#A9770F" />
                  </radialGradient>
                </defs>
                <circle className="fcx-ring-track" cx="46" cy="46" r="40" />
                <circle
                  className="fcx-ring-fill"
                  cx="46" cy="46" r="40" pathLength={100}
                  stroke={`url(#${stoneId})`}
                  transform="rotate(-90 46 46)"
                />
              </svg>
              <strong data-fcx-score>{told ? huScore(scoreOutOfTen) : '0,0'}</strong>
            </span>
            <small>Mezo értékelése</small>
          </div>
        </div>

        <section className="fcx-result">
          <h1 className="sr-only" tabIndex={-1} ref={headingRef}>{stars} csillag az ötből</h1>
          <p className="fcx-verdict">{mealVerdict(stars)}</p>
        </section>

        <div className="fcx-counters">
          <span>
            <ClayIcon name="i-tanyer" size={24} />
            <strong data-fcx-count="kcal">{counter(kcal)}</strong><small>kcal</small>
          </span>
          <span>
            <ClayIcon name="i-hus" size={24} />
            <strong data-fcx-count="p">{counter(proteinG)}</strong><small>g fehérje</small>
          </span>
          <span>
            <ClayIcon name="i-gabona" size={24} />
            <strong data-fcx-count="c">{counter(carbsG)}</strong><small>g szénhidrát</small>
          </span>
          <span>
            <ClayIcon name="i-avokado" size={24} />
            <strong data-fcx-count="f">{counter(fatG)}</strong><small>g zsír</small>
          </span>
        </div>

        <div className={`fcx-foot${onDetails ? '' : ' is-single'}`}>
          <button type="button" className="fcx-close" onClick={onClose}>Vissza a naphoz</button>
          {onDetails && (
            <button type="button" className="fcx-cta" onClick={onDetails}>
              <span aria-hidden="true"><ClayIcon name="i-makro" size={28} /></span>
              <span><strong>Részletek</strong><small>Miből jött ez a pontszám</small></span>
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
