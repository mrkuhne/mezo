// ============================================================
// Mezo · FuelWeekDayGlass — egy nap részletező ÜVEGDOBOZA a Trendek heti képéből (Fuel Titanium
// S3, mezo-83g0; manifeszt C5 „napi minőség a heti képben").
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `trendDayGlass` (:244) + `dimFactView` (:233), a fuel-pages.css `.tx-dim*` / `.tx-rows` /
// `.tx-meters` / `dialog.glass` blokkjaival. Anatómia: üveg-hero (a napi pont a nagy szám) →
// chipek (keret · pont · edzés) → keret-sáv → a SEMLEGES keret-tény → a két étkezéshez tartozó
// dimenzió SORONKÉNT tálalt tényekkel → ajtó a nap saját lapjára → lábjegyzet.
//
// OWNER-DÖNTÉS, amit a markup hordoz: „a nutrition alatti rész nagyon össze van dobva és nehéz
// olvasni" — ezért a dimenzió-tények EGY-EGY SORBAN állnak (címke balra, érték jobbra), nem
// chip-tömegben. A prototípus `dimFactView`-ja tömörített szövegpárokat bontott sorokra; itt a
// valódi adat már strukturált, ezért a KIMENETI alakot (sorok + mérők + jegyzet) vesszük át,
// nem a szöveg-parsolást.
//
// SZÉGYENMENTES: a keret felett járó nap SEMLEGES hangot kap — „így alakult", soha nem „hiba".
// ŐSZINTE-NULL: nem naplózott napra nem találunk ki becslést, és kimondjuk, hogy kimarad a heti
// átlagból; pontszám nélküli dimenzió „—"-t és szaggatott keretet kap, nem nullát.
//
// A doboz natív <dialog class="glass">: Escape és backdrop a platformtól, a `showModal`/`close`
// feature-detektált (a ház mintája: FuelEnergyHero, FuelStackItemGlass) — a jsdom nem hoz
// HTMLDialogElement-et.
//
// C5: a felület CSAK a már kiszámolt napi értékelést OLVASSA. Étkezés-coach előzményt NEM kér és
// nem generál — a coach-történet cache-only.
// ============================================================
import { useEffect, useId, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { huInt } from '@/shared/lib/huNum'
import { huMonthDayDow } from '@/shared/lib/dates'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import type { FuelWeekDay } from '@/data/fuel/mealApi'
import type { WeekDayVM } from '@/features/fuel/logic/fuelWeekView'

/** Egy dimenzió egy ténysora — címke + kész, olvasható érték. */
export interface DimFactRow { label: string; value: string }

/** A napi motor két ÉTKEZÉSHEZ tartozó dimenziója, a motor saját súlyaival (a többi négy — edzés,
 *  alvás, naplózás, ritmus — az Én oldal napi nézetén él, ide nem másoljuk). */
interface DimView {
  key: 'nutrition' | 'quality'
  label: string
  icon: ClayIconName
  color: string
  /** A napi értékelés hány százalékát adja ez a szempont. */
  weightPct: number
  score: number | null
  rows: DimFactRow[]
}

/** „148 / 160 g" alakú cél-pár, vagy puszta érték, ha nincs cél (nem hazudunk célt). */
const pair = (value: number, target: number | null, unit: string): string =>
  target != null && target > 0
    ? `${huInt(value)} / ${huInt(target)}${unit ? ` ${unit}` : ''}`
    : `${huInt(value)}${unit ? ` ${unit}` : ''}`

export function FuelWeekDayGlass({ day, rollup, subscores, onClose }: {
  day: WeekDayVM
  /** A nap nyers rollup-sora — a makró-tények EGYETLEN forrása (a Fuel kanonikus adata). */
  rollup: FuelWeekDay
  /** A hat dimenziós napi értékelés két étkezés-dimenziója, 0–100; null = nincs adat. */
  subscores: { nutrition: number | null; quality: number | null }
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const navigate = useNavigate()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Feature-detektált: a jsdom nem implementálja a dialogot, ott az attribútum a fallback.
    if (typeof el.showModal === 'function') el.showModal()
    else el.setAttribute('open', '')
  }, [])

  const dayName = huMonthDayDow(day.date)

  if (!day.logged) {
    return (
      <dialog
        ref={ref}
        className="ftx-glass glass is-empty"
        aria-labelledby={titleId}
        onCancel={(event) => { event.preventDefault(); onClose() }}
        onClose={onClose}
      >
        <div className="ftx-glass-hero">
          <span aria-hidden="true"><ClayIcon name="i-tanyer" size={52} /></span>
          <div>
            <strong>—</strong>
            <small id={titleId}>{dayName}</small>
          </div>
        </div>
        <p className="ftx-glass-honest">
          <span aria-hidden="true"><ClayIcon name="i-mezo" size={26} /></span>
          <span>
            <small>ŐSZINTÉN</small>
            Ezen a napon nem naplóztál. Nem töltjük ki becsléssel, és a heti átlagból is kimarad.
          </span>
        </p>
        <button type="button" className="ftx-glass-link" onClick={() => { onClose(); navigate(`/fuel?d=${day.date}`) }}>
          <span aria-hidden="true"><ClayIcon name="i-naplo" size={28} /></span>
          <span><strong>Pótolom a napot</strong><small>A nap saját lapján bármikor felvehető</small></span>
          <b aria-hidden="true">›</b>
        </button>
        <button type="button" className="ftx-glass-close" onClick={onClose}>Bezárom</button>
      </dialog>
    )
  }

  const dims: DimView[] = [
    {
      key: 'nutrition', label: 'Táplálkozás', icon: 'i-makro', color: 'var(--coral)', weightPct: 30,
      score: subscores.nutrition,
      rows: [
        { label: 'Kalória', value: pair(rollup.consumed.kcal, day.targetKcal, 'kcal') },
        { label: 'Fehérje', value: pair(rollup.consumed.p, rollup.targets.p, 'g') },
        { label: 'Szénhidrát', value: pair(rollup.consumed.c, rollup.targets.c, 'g') },
        { label: 'Zsír', value: pair(rollup.consumed.f, rollup.targets.f, 'g') },
      ],
    },
    {
      key: 'quality', label: 'Minőség', icon: 'i-feldolgozas', color: 'var(--amber)', weightPct: 15,
      score: subscores.quality,
      // A feldolgozottság/mikro-részletek a napi motorból nem jönnek le naponta — inkább semmit
      // írunk, mint kitalált tényt. Az étkezésenkénti bontás a Mai oldal értékelőjén él.
      rows: [],
    },
  ]

  const overBy = day.over && day.targetKcal != null ? rollup.consumed.kcal - day.targetKcal : null

  return (
    <dialog
      ref={ref}
      className={`ftx-glass glass${day.over ? ' is-over' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClose={onClose}
    >
      <div className="ftx-glass-hero">
        <span aria-hidden="true"><ClayIcon name="i-heti" size={52} /></span>
        <div>
          <strong>{day.dayScore == null ? '—' : huInt(day.dayScore)}</strong>
          <small id={titleId}>{dayName} · napi pont</small>
        </div>
      </div>

      <div className="ftx-glass-chips">
        <span>{huInt(rollup.consumed.kcal)} / {day.targetKcal == null ? '—' : huInt(day.targetKcal)} kcal</span>
        <span>{day.dayScore == null ? 'még nincs napi pont' : `napi pont ${huInt(day.dayScore)}/100`}</span>
        {day.training && <span>edzésnap</span>}
      </div>

      {day.pct != null && (
        <div className="ftx-glass-bar" aria-hidden="true">
          <i style={{ '--ftx-w': `${Math.min(100, Math.round(day.pct))}%` } as React.CSSProperties} />
        </div>
      )}

      {/* SEMLEGES keret-tény: a túllépés TÉNY, nem vád. „így alakult" — az owner hangja. */}
      <p className="ftx-glass-fact">
        A kereted ezen a napon <b>{day.targetKcal == null ? '—' : `${huInt(day.targetKcal)} kcal`}</b> volt
        {day.training ? ' — edzésnapra igazítva' : ''}.{' '}
        {overBy != null
          ? `${huInt(overBy)} kcal-lal fölé ment; így alakult.`
          : 'Belefértél — így alakult.'}
      </p>

      <div className="ftx-dims">
        {dims.map((dim) => (
          <div
            key={dim.key}
            className={`ftx-dim${dim.score == null ? ' is-degraded' : ''}`}
            style={{ '--ftx-dim-color': dim.color } as React.CSSProperties}
          >
            <div className="ftx-dim-head">
              <span aria-hidden="true"><ClayIcon name={dim.icon} size={30} /></span>
              <span>
                <strong>{dim.label}</strong>
                <small>a napi értékelés {dim.weightPct}%-a</small>
              </span>
              <b>{dim.score == null ? '—' : huInt(dim.score)}</b>
            </div>
            {dim.score != null && (
              <i className="ftx-dim-bar" aria-hidden="true">
                <b style={{ '--ftx-w': `${Math.min(100, dim.score)}%` } as React.CSSProperties} />
              </i>
            )}
            {dim.rows.length > 0 ? (
              // OLVASHATÓ: egy tény = egy sor. Lista, hogy a képernyőolvasó is sorként mondja.
              <ul className="ftx-rows">
                {dim.rows.map((row) => (
                  <li key={row.label}><span>{row.label}</span><b>{row.value}</b></li>
                ))}
              </ul>
            ) : (
              <p className="ftx-dim-note">Ehhez a szemponthoz még nincs elég adat ezen a napon.</p>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="ftx-glass-link" onClick={() => { onClose(); navigate(`/fuel?d=${day.date}`) }}>
        <span aria-hidden="true"><ClayIcon name="i-naplo" size={28} /></span>
        <span><strong>Megnézem a napot</strong><small>Az étkezések és az értékelésük a nap lapján</small></span>
        <b aria-hidden="true">›</b>
      </button>

      <p className="ftx-note">
        A napi értékelés hat szempontból áll — itt a két étkezéshez tartozó látszik. A többi
        (edzés, alvás, naplózás, ritmus) az Én oldal napi nézetén él.
      </p>
      <button type="button" className="ftx-glass-close" onClick={onClose}>Bezárom</button>
    </dialog>
  )
}
