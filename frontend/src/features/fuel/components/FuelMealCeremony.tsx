// ============================================================
// Mezo · FuelMealCeremony — a naplózást lezáró ünneplés (mezo-bqwyo · jutalomoldalak mezo-p2777
// · üvegben mezo-me75u.10).
//
// A tulajdonos 2026-09-18: „volt egy nagyon szépen kidolgozott reward screen az edzés
// végénél… ezt be akartam tenni a kajához is". 2026-09-22 (jutalomoldalak, spec
// docs/superpowers/specs/2026-09-22-jutalomoldalak-design.md): EGY család, KÉT súlyosztály.
// Az étkezést naponta 3–5-ször rögzíti, ezért ez a KIS pillanat: alulról felcsúszó lap a nap
// fölött — nem a teljes képernyős, többütemes edzés-ünneplés.
//
// A lap (U10, üveg — prototípus docs/design_2.0/prototypes/src/uveg-reteg-body.html `cerEtel()`,
// tulajdonosi OK v3): EGY lebegő arany üveglap, EGY középre rendezett oszlop — szemöldök, az
// étkezés és az ideje → a Mezo pontja egy érmén (a kő a GYŰRŰ, sötét, megvilágított mag, a
// `t-score` ikon a gradiens számjegy fölött) → felirat → az öt csillag egy sorban → a verdikt →
// négy lapos számláló-cella → a két kiút (vissza a naphoz · Részletek). A háttérre koppintás =
// vissza a naphoz.
//
// Minden szám PROP: ez a komponens nem számol és nem talál ki semmit. Pontszám nélkül a hívó
// meg sem nyitja (őszinte-null: a csillag nem születhet a semmiből).
//
// Mozgás: EGY rAF-menet (1500 ms). ELŐBB a lap: a menet írja a `--rise`-t (felcsúszás,
// 0–500 ms). Csak ha a lap LANDOLT, jön a gyújtás (`--p`, 500–1500 ms: gyűrű, pont, csillagok,
// számlálók) és az ütem-osztályok (`is-b1` 1150 ms: verdikt + makrók, `is-b2` 1400 ms: a
// gombok). A tulajdonos (U10, 2026-09-26): a csillagok ne gyulladjanak, amíg a fiók még
// emelkedik. A sorrendet a menet maga garantálja — a lap mozgása is az övé, ezért nincs mire
// várni (transitionend). CSS-átmenet a lapon szándékosan nincs: egy háttérbe tett webview a
// frissen indított átmenetet a kezdőértéken fagyasztja — itt az a képernyőn KÍVÜL ragadt lapot
// jelentene. Csökkentett mozgásnál nincs menet: az első render már a végállapot, csúszás nélkül.
// ============================================================
import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
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

/** A lap felcsúszása — a gyújtás csak ezután indul. */
export const FCX_RISE_MS = 500
const IGNITE_MS = 1000
const DURATION_MS = FCX_RISE_MS + IGNITE_MS
const BEATS = { b1: FCX_RISE_MS + 650, b2: FCX_RISE_MS + 900 } as const
const STAR_SLOTS = [0, 1, 2, 3, 4]

const COUNTERS: Array<{ key: 'kcal' | 'p' | 'c' | 'f'; icon: Icon3DName; label: string }> = [
  { key: 'kcal', icon: 't-plate', label: 'kcal' },
  { key: 'p', icon: 't-protein', label: 'g fehérje' },
  { key: 'c', icon: 't-carb', label: 'g szénhidrát' },
  { key: 'f', icon: 't-fat', label: 'g zsír' },
]

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
  const values: Record<string, number> = { kcal, p: proteinG, c: carbsG, f: fatG }

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
    // mezo-7tj3j: a start az ELSŐ rAF-időbélyeg, nem performance.now() — a két óra origója
    // eltérhet (jsdom alatt másodpercekkel is), és a "mindkét végén vágás" akkor 0-n ragadó
    // count-upot ad, amíg a rAF-óra be nem éri a másikat.
    let started: number | null = null
    const counts: Record<string, number> = { kcal, p: proteinG, c: carbsG, f: fatG }
    const paint = (ms: number) => {
      // 1. a lap: felcsúszik, és a gyújtás ADDIG nulla, amíg nem landolt
      root.style.setProperty('--rise', String(1 - ease(Math.min(1, ms / FCX_RISE_MS))))
      const p = ms < FCX_RISE_MS ? 0 : ease(Math.min(1, (ms - FCX_RISE_MS) / IGNITE_MS))
      // 2. a gyújtás: gyűrű, pont, csillagok, számlálók
      sheet.style.setProperty('--p', String(p))
      sheet.querySelectorAll<HTMLElement>('[data-fcx-count]').forEach((el) => {
        el.textContent = huNumber((counts[el.dataset.fcxCount ?? ''] ?? 0) * p)
      })
      const score = sheet.querySelector<HTMLElement>('[data-fcx-score]')
      if (score) score.textContent = huScore(scoreOutOfTen * p)
      sheet.querySelectorAll<HTMLElement>('[data-fcx-star]').forEach((star) => {
        star.classList.toggle('is-lit', p > 0 && p * stars >= Number(star.dataset.fcxStar) + 1 - 0.001)
      })
      root.classList.toggle('is-b1', ms >= BEATS.b1)
      root.classList.toggle('is-b2', ms >= BEATS.b2)
    }
    const frame = (now: number) => {
      if (started === null) started = now
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
        className="fcx-sheet glass"
        style={{ '--p': told ? 1 : 0, '--score': ratio } as CSSProperties}
      >
        <span className="fcx-grab" aria-hidden="true" />

        <div className="fcx-top">
          <span className="fcx-eyebrow">A NAPOD RÉSZE LETT</span>
          <p className="fcx-meal">{mealLabel}</p>
          <span className="fcx-when">{timeLabel}</span>
        </div>

        <h1 className="sr-only" tabIndex={-1} ref={headingRef}>{stars} csillag az ötből</h1>

        {/* A Mezo pontja egy érmén: a kő a gyűrű, a szám a sötét magon — sosem a kövön. */}
        <div className="fcx-score">
          <span className="fcx-medal">
            <svg className="fcx-ring" viewBox="0 0 80 80" aria-hidden="true">
              <defs>
                <linearGradient id={stoneId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#FFE9A8" />
                  <stop offset="0.55" stopColor="#E0AC2F" />
                  <stop offset="1" stopColor="#A9770F" />
                </linearGradient>
              </defs>
              <circle className="fcx-ring-track" cx="40" cy="40" r="36" pathLength={100} />
              <circle
                className="fcx-ring-fill"
                cx="40" cy="40" r="36" pathLength={100}
                stroke={`url(#${stoneId})`}
              />
            </svg>
            <span className="fcx-core">
              <Icon3D name="t-score" size={26} />
              <strong data-fcx-score>{told ? huScore(scoreOutOfTen) : '0,0'}</strong>
            </span>
          </span>
          <small className="fcx-cap">Mezo értékelése</small>
          <div className="fcx-stars" aria-hidden="true">
            {STAR_SLOTS.map((i) => (
              <i key={i} data-fcx-star={i} className={told && i < stars ? 'is-lit' : undefined}>
                <Icon3D name="t-star-empty" size={30} className="fcx-star-off" />
                <Icon3D name="t-star" size={30} className="fcx-star-on" />
              </i>
            ))}
          </div>
        </div>

        <section className="fcx-result">
          <p className="fcx-verdict">{mealVerdict(stars)}</p>
        </section>

        <div className="fcx-counters">
          {COUNTERS.map((c) => (
            <span key={c.key} className="uv-flat">
              <Icon3D name={c.icon} size={24} />
              <strong data-fcx-count={c.key}>{counter(values[c.key])}</strong><small>{c.label}</small>
            </span>
          ))}
        </div>

        <div className={`fcx-foot${onDetails ? '' : ' is-single'}`}>
          <button type="button" className="fcx-close uv-flat" onClick={onClose}>Vissza a naphoz</button>
          {onDetails && (
            <button type="button" className="fcx-cta" onClick={onDetails}>
              <Icon3D name="t-macro" size={24} />
              <span><strong>Részletek</strong><small>Miből jött ez a pontszám</small></span>
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
