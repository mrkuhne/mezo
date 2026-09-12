// ============================================================
// Mezo · Fuel Trendek (S0 váz: mezo-o6uv · tartalom: Fuel Titanium S3, mezo-83g0).
// A jóváhagyott negyedik Fuel-cél: „Jól ment a hetem?"
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `trendek` (:199), `weekBars` (:192), `trendDayGlass` (:244) + a fuel-pages.css „Trendek"
// blokkja (:722-821). Anatómia fentről le:
//   a HETI KÉP (a főszereplő) — a hét napjai a kerethez mérve, mindegyiken a nap AI pontja,
//     alatta a semleges heti olvasat,
//   három mutató-csempe — napi átlag · étkezés-minőség · heti súlyátlag (a két utóbbi a C2-ben
//     felszabadított heti átlag),
//   a hétköznap/hétvége kontraszt — két kitöltődő sáv, ez a hét fő üzenete (C1),
//   a hosszabb táv — evés és súly EGY időtengelyen (C3, FuelHorizon),
//   a mintázatok — HIVATKOZÁSOK a kanonikus Mezo-elemre (C4).
//
// Owner-döntések, amiket a markup hordoz:
//   • a heti kép a protagonista; a hosszú táv és a mintázatok ALATTA állnak,
//   • egy nap az AI NAPI PONTJÁT mutatja („2.1, 2.3" nyers makró-pár = „nem túl beszédes"), és
//     koppintásra üvegdobozban nyílik,
//   • a hétköznap/hétvége sávok kitöltődnek, a napi átlag / étkezés-minőség / heti súlyátlag
//     számok felszámolódnak.
//
// SZÉGYENMENTES — ez a ház legkockázatosabb felülete: a keret FELETT járó nap más SZÍNT kap, de
// soha nem hibaállapotot, és egyetlen szó sem osztályozza a felhasználót. A gyéren naplózott hét
// őszintén van leírva, nem „bukásként" pontozva. A hang: „így alakult".
// ŐSZINTE-NULL: a nem naplózott nap nem nulla — kimarad minden átlagból, és „nincs adat"-ként
// rajzolódik; ha a heti átlagok nullok, a csempék „—"-t írnak.
//
// ADATFORRÁS, új backend nélkül:
//   • a hét keretei/fogyása: `useFuelWeek()` 7 napos rollupja (+ a C2 két átlaga),
//   • a NAP AI PONTJA: a MEGLÉVŐ hat dimenziós napi értékelés (`getDayEvaluation` →
//     `MeWeekDay.score`/`.subscores`), a `useMeWeek` heti rollupon keresztül — ez a lap NEM
//     számol új pontszámot,
//   • az edzésnap (C6): ugyanonnan, `MeWeekDay.workoutCount > 0` — tehát tényleg naplózott edzés.
// C5: a coach-történet cache-only — ez a lap csak OLVAS, étkezés-coach generálást nem indít.
// ============================================================
import { useState } from 'react'
import { useFuelWeek, mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { useMeWeek } from '@/data/me/meWeekHooks'
import { useFuelHorizon } from '@/data/fuel/fuelHorizonHooks'
import { hu1, huInt } from '@/shared/lib/huNum'
import { huMonthDayDow } from '@/shared/lib/dates'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useFuelCountUp } from '@/features/fuel/components/FuelMacroRings'
import { FuelHorizon } from '@/features/fuel/components/FuelHorizon'
import { FuelWeekDayGlass } from '@/features/fuel/components/FuelWeekDayGlass'
import { buildWeekView, loggedKcalAvg, type WeekDayVM } from '@/features/fuel/logic/fuelWeekView'

/** A három mutató-csempe — a prototípus `TX_STAT`-ja ház-tokenekkel és clay-szimbólumokkal. */
const STAT_FACE: Record<'avg' | 'score' | 'weight', {
  label: string; icon: ClayIconName; color: string; unit: string; dec: 0 | 1
}> = {
  avg: { label: 'Napi átlag', icon: 'i-tanyer', color: 'var(--sky)', unit: 'kcal', dec: 0 },
  score: { label: 'Étkezés-minőség', icon: 'i-feldolgozas', color: 'var(--lav)', unit: '', dec: 1 },
  weight: { label: 'Heti súlyátlag', icon: 'i-suly', color: 'var(--rose)', unit: 'kg', dec: 1 },
}

/** Egy felszámoló numerál. Üres érték „—" — a count-up hookot akkor sem hívjuk feltételesen
 *  (React hook-szabály), csak a kimenetét dobjuk el. `useFuelCountUp` csökkentett mozgás és
 *  jsdom alatt azonnal a végértéket adja, ezért a tesztek szinkron olvashatók. */
function CountNumeral({ value, dec }: { value: number | null; dec: 0 | 1 }) {
  const scale = dec === 1 ? 10 : 1
  const counted = useFuelCountUp(value == null ? 0 : Math.round(value * scale)) / scale
  if (value == null) return <>—</>
  return <>{dec === 1 ? hu1(counted) : huInt(counted)}</>
}

function StatTile({ kind, value }: { kind: keyof typeof STAT_FACE; value: number | null }) {
  const face = STAT_FACE[kind]
  return (
    <div
      className={`ftx-tile is-${kind}`}
      style={{ '--ftx-tile-color': face.color } as React.CSSProperties}
    >
      <span className="ftx-tile-art" aria-hidden="true"><ClayIcon name={face.icon} size={32} /></span>
      <strong>
        <CountNumeral value={value} dec={face.dec} />
        {face.unit && <small>{face.unit}</small>}
      </strong>
      <span className="ftx-tile-label">{face.label}</span>
    </div>
  )
}

/** Egy nap a heti képben: a keret szaggatott vonala + a fogyás kitöltése (vagy a hézag-jel), a
 *  nap AI pontja és a napnév. A magasság a hét legnagyobb értékéhez van skálázva. */
function WeekDayBar({ day, max, onOpen }: { day: WeekDayVM; max: number; onOpen: () => void }) {
  const h = (v: number) => `${Math.max(4, Math.round((v / max) * 100))}%`
  const aria = day.logged
    ? `${huMonthDayDow(day.date)}: ${huInt(day.kcal!)} kcal a ${day.targetKcal == null ? 'megadott' : `${huInt(day.targetKcal)} kcal-os`} keretből`
      + `${day.dayScore == null ? ', napi pont még nincs' : `, napi pont ${huInt(day.dayScore)}`}`
    : `${huMonthDayDow(day.date)}: nincs adat`
  return (
    <button
      type="button"
      className={`ftx-day${day.weekend ? ' is-weekend' : ''}${day.logged ? '' : ' is-empty'}`
        + `${day.over ? ' is-over' : ''}`}
      aria-label={aria}
      onClick={onOpen}
    >
      <span className="ftx-col" aria-hidden="true">
        {day.targetKcal != null && (
          <i className="ftx-target" style={{ '--ftx-h': h(day.targetKcal) } as React.CSSProperties} />
        )}
        {day.logged
          ? <i className="ftx-fill" style={{ '--ftx-h': h(day.kcal!) } as React.CSSProperties} />
          : <i className="ftx-gap" />}
      </span>
      <b className="ftx-day-score" aria-hidden="true">
        {day.dayScore == null ? '·' : huInt(day.dayScore)}
      </b>
      <span className="ftx-day-name" aria-hidden="true">{day.label}</span>
      {/* Őszinte hiány: a „nincs adat" a képernyőolvasóé és a tesztnek is egy valódi szöveg —
          a hét oszlopos rácsban kiírva nem férne el, ezért vizuálisan rejtett. */}
      {!day.logged && <span className="sr-only">nincs adat</span>}
      {day.training && <u className="ftx-train" aria-hidden="true" />}
    </button>
  )
}

/** Hétköznap vs hétvége — kitöltődő sáv, a prototípus `tx-splitrow`-ja. A sáv a kerethez mért
 *  százalékot rajzolja, 130%-ra skálázva (a keret fölötti tartomány is elfér benne). */
function SplitRow({ label, icon, color, pct }: {
  label: string; icon: ClayIconName; color: string; pct: number | null
}) {
  return (
    <div className="ftx-splitrow" style={{ '--ftx-split-color': color } as React.CSSProperties}>
      <span className="ftx-split-art" aria-hidden="true"><ClayIcon name={icon} size={34} /></span>
      <span className="ftx-split-copy">
        <strong>{label}</strong>
        <i aria-hidden="true">
          <b style={{ '--ftx-w': `${pct == null ? 0 : Math.min(100, (pct / 130) * 100)}%` } as React.CSSProperties} />
        </i>
      </span>
      <b>{pct == null ? '—' : <>{huInt(Math.round(pct))}<small>%</small></>}</b>
    </div>
  )
}

export function FuelTrendekPage() {
  const { start, weekDays, mealScoreAvg, weightAvgKg } = useFuelWeek()
  const { week: meWeek } = useMeWeek(start)
  const { weeks: horizonWeeks } = useFuelHorizon(start)
  const [openDate, setOpenDate] = useState<string | null>(null)

  // A nap AI pontja és az edzésnap-jelölés a MEGLÉVŐ napi értékelésből (új formula nélkül).
  const dayScores: Record<string, number | null> = {}
  const trainingDays: string[] = []
  const subscoresByDate: Record<string, { nutrition: number | null; quality: number | null }> = {}
  for (const d of meWeek?.days ?? []) {
    dayScores[d.date] = d.score ?? null
    if (d.workoutCount > 0) trainingDays.push(d.date)
    subscoresByDate[d.date] = {
      nutrition: d.subscores.nutrition ?? null,
      quality: d.subscores.quality ?? null,
    }
  }

  const vm = buildWeekView({ start, days: weekDays, mealScoreAvg, weightAvgKg }, dayScores, trainingDays)
  const avgKcal = loggedKcalAvg(vm.days)
  // A sávok közös léptéke: a hét legnagyobb kerete/fogyása, legalább 2400 — így egy gyéren
  // naplózott hét egyetlen napja sem nyúlik a tetőig.
  const max = Math.max(2400, ...vm.days.map(d => Math.max(d.kcal ?? 0, d.targetKcal ?? 0)))

  // SEMLEGES heti olvasat. Egy alig naplózott hét le van ÍRVA, nem leosztályozva.
  const delta = vm.weekdayAvgPct != null && vm.weekendAvgPct != null
    ? vm.weekendAvgPct - vm.weekdayAvgPct
    : null
  const read = vm.loggedCount === 0
    ? 'Ezen a héten még nincs naplózott nap. Nem találgatunk helyetted — amit felveszel, az rögtön itt lesz.'
    : delta == null
      ? `${vm.loggedCount} naplózott nap van a héten. A hét többi része még előtted áll — üresen hagyjuk, nem találgatjuk.`
      : Math.abs(delta) < 5
        ? `${vm.loggedCount} naplózott nap: a hétköznapok és a hétvége nagyjából egy szinten mozognak.`
        : delta > 0
          ? `Hétvégén átlagosan ${huInt(Math.round(delta))}%-kal többet ettél a keretedhez mérve, mint hétköznap. Így alakult, és most már látod.`
          : `Hétköznap átlagosan ${huInt(Math.round(Math.abs(delta)))}%-kal többet ettél a keretedhez mérve, mint hétvégén. Így alakult, és most már látod.`

  const openDay = openDate ? vm.days.find(d => d.date === openDate) ?? null : null
  const openRollup = openDate ? weekDays.find(d => d.date === openDate) ?? null : null

  return (
    <MozaikPage tone="sage" className="ftx-page">
      <EntranceGroup>
        <PageBody className="ftx-body">
          <div className="ftx-hero">
            <span className="ftx-glow" aria-hidden="true" />
            <h1>Trendek</h1>
            <p className="ftx-week">{deriveWeekTitle(start === '' ? mondayIso() : start)}</p>
            <div className="ftx-big">
              <strong>{vm.loggedCount}</strong>
              <span>
                <b>/ 7 naplózott nap</b>
                <small>EBBŐL ÁLL A HETI KÉP</small>
              </span>
            </div>
            <div className="ftx-bars">
              {vm.days.map(day => (
                <WeekDayBar key={day.date} day={day} max={max} onOpen={() => setOpenDate(day.date)} />
              ))}
            </div>
            <p className="ftx-read">{read}</p>
            <p className="ftx-hint">A szám a nap pontja · koppints a részletekért</p>
          </div>

          <div className="ftx-tiles">
            <StatTile kind="avg" value={avgKcal} />
            {/* A heti étkezés-pont 0..1-ben érkezik; a 0–10-es skála a ház olvasata. */}
            <StatTile kind="score" value={vm.mealScoreAvg == null ? null : vm.mealScoreAvg * 10} />
            <StatTile kind="weight" value={vm.weightAvgKg} />
          </div>

          <h2 className="ftx-section">Hétköznap és hétvége</h2>
          <div className="ftx-split">
            <SplitRow label="Hétköznap" icon="i-nap" color="var(--sky)" pct={vm.weekdayAvgPct} />
            <SplitRow label="Hétvége" icon="i-hold" color="var(--amber)" pct={vm.weekendAvgPct} />
            {delta == null ? (
              <p className="ftx-split-note">
                A kettő összevetéséhez mindkét oldalon kell legalább egy naplózott nap — amíg nincs,
                üresen hagyjuk.
              </p>
            ) : (
              <p className="ftx-split-note">
                A különbség <b>{huInt(Math.round(Math.abs(delta)))} százalékpont</b>{' '}
                {delta > 0 ? 'a hétvége javára' : 'a hétköznapok javára'}.
              </p>
            )}
          </div>

          <h2 className="ftx-section">Hosszabb táv</h2>
          <FuelHorizon weeks={horizonWeeks} />
        </PageBody>
      </EntranceGroup>

      {openDay && openRollup && (
        <FuelWeekDayGlass
          day={openDay}
          rollup={openRollup}
          subscores={subscoresByDate[openDay.date] ?? { nutrition: null, quality: null }}
          onClose={() => setOpenDate(null)}
        />
      )}
    </MozaikPage>
  )
}
