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
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useFuelWeek, useFuelWeekRollup, mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { useMeWeek } from '@/data/me/meWeekHooks'
import { useFuelHorizon } from '@/data/fuel/fuelHorizonHooks'
import { useFuelDay } from '@/data/fuel/fuelHooks'
import { usePatterns } from '@/data/insights/patternsHooks'
import { hu1, huInt } from '@/shared/lib/huNum'
import { addDays, huMonthDayDow } from '@/shared/lib/dates'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useFuelCountUp } from '@/features/fuel/components/FuelMacroRings'
import { FuelHorizon } from '@/features/fuel/components/FuelHorizon'
import { FuelWeekDayGlass } from '@/features/fuel/components/FuelWeekDayGlass'
import { fuelPatternRefs } from '@/features/fuel/logic/fuelPatternRefs'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { hhmmFromLoggedAt } from '@/features/fuel/logic/buildDayPlan'
import { buildWeekView, mealDayScore, loggedKcalAvg, weekDeltas, type WeekDayVM, type WeekDelta } from '@/features/fuel/logic/fuelWeekView'

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

/** C2: a múlt héthez mért változás a csempén — a prototípus `<em>▲ …</em>`-je (fuel-pages.js
 *  :211-212). SZÉGYENMENTES: IRÁNY és mennyiség, semmi más. Nincs „jó"/„rossz" szín és nincs
 *  minősítő szó — egy heti elmozdulás nem ítélet; a hue a lap meglévő semleges `--sub`-ja.
 *  A nyíl önmagában a képernyőolvasónak néma, ezért mellé egy rejtett, ugyancsak semleges
 *  mondat kerül („több"/„kevesebb"), nem pedig „javult"/„romlott". */
function TileDelta({ delta, unit, dec }: { delta: WeekDelta; unit: string; dec: 0 | 1 }) {
  const amount = `${dec === 1 ? hu1(delta.amount) : huInt(delta.amount)}${unit ? ` ${unit}` : ''}`
  return (
    <em className="ftx-delta">
      <span aria-hidden="true">{delta.direction === 'up' ? '▲' : '▼'} {amount}</span>
      <span className="sr-only">
        {delta.direction === 'up' ? 'a múlt héthez mérve ennyivel több' : 'a múlt héthez mérve ennyivel kevesebb'}
        {`: ${amount}`}
      </span>
    </em>
  )
}

function StatTile({ kind, value, delta }: {
  kind: keyof typeof STAT_FACE; value: number | null; delta?: WeekDelta
}) {
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
      {/* Betöltés közben / korábbi hét nélkül NINCS delta — se nulla, se helykitöltő. */}
      {delta && <TileDelta delta={delta} unit={face.unit} dec={face.dec} />}
    </div>
  )
}

/** Egy nap a heti képben: a keret szaggatott vonala + a fogyás kitöltése (vagy a hézag-jel), a
 *  nap AI pontja és a napnév. A magasság a hét legnagyobb értékéhez van skálázva. */
function WeekDayBar({ day, max, onOpen }: { day: WeekDayVM; max: number; onOpen: () => void }) {
  const h = (v: number) => `${Math.max(4, Math.round((v / max) * 100))}%`
  const aria = day.logged
    ? `${huMonthDayDow(day.date)}: ${huInt(day.kcal!)} kcal a ${day.targetKcal == null ? 'megadott' : `${huInt(day.targetKcal)} kcal-os`} keretből`
      + `${day.dayScore == null ? ', étkezés-pont még nincs' : `, étkezés-pont ${huScore(day.dayScore)}`}`
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
        {day.dayScore == null ? '·' : huScore(day.dayScore)}
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

/**
 * A hét-váltó URL-értéke. FIGYELEM — ez a lap SAJÁT `?w=` paramétere: a MEGJELENÍTETT HETET
 * választja ki (`?w=elozo` = a múlt hét), hogy a nézet linkelhető legyen és újratöltés után is
 * megmaradjon. NEM azonos a logoló lapok `?w=` paraméterével, ami egy napon BELÜLI étkezés-ablak
 * kulcsa (`fuelSwimlane.tileKey`). A két jelentés véletlenül ugyanazt a betűt kapta: ne vonjuk
 * össze őket, és ne hívjuk itt a `tileKey`-t.
 */
const WEEK_PARAM = 'w'
const PREV_WEEK_VALUE = 'elozo'

/**
 * C5 (mezo-83g0): a nap étkezései a nyitott üvegdobozban — a prototípus `trendDayGlass`
 * étkezés-szekciója (`fuel-pages.js:244+`), a MEGLÉVŐ napi olvasásból (`useFuelDay`).
 *
 * FETCH-FEGYELEM: ez a komponens KIZÁRÓLAG a nyitott doboz belsejében van beillesztve, tehát a
 * napi kérés a doboz megnyitásakor indul — nem hét nappal előre, és naplózatlan napon soha (az
 * üvegdoboz naplózatlan ága a gyerekeket el sem rendereli).
 *
 * C5 MÁSODIK fele: a coach-TÖRTÉNET cache-only. Ez a lista a napot OLVASSA; étkezés-coach
 * verdiktet nem kér és nem generál. Az étkezés pontja csak akkor látszik, ha a napi válasz MÁR
 * hordozza — különben egyszerűen nem áll ott semmi, nem nulla és nem „folyamatban".
 */
function DayMealList({ date, onOpenMeal }: { date: string; onOpenMeal: (mealId: string) => void }) {
  const { fuel, isPending } = useFuelDay(date)

  if (isPending) {
    return (
      <>
        <h2 className="ftx-section">A nap étkezései</h2>
        <p className="ftx-meals-note">Töltjük a nap étkezéseit…</p>
      </>
    )
  }
  return (
    <>
      <h2 className="ftx-section">A nap étkezései</h2>
      {fuel.meals.length === 0 ? (
        // A rollup szerint volt fogyás ezen a napon, a napi olvasás mégsem ad étkezést: ezt
        // kimondjuk, nem üres listát rajzolunk.
        <p className="ftx-meals-note">Erről a napról nincs tételes étkezés mentve.</p>
      ) : (
        <ul className="ftx-meals">
          {fuel.meals.map((meal) => (
            <li key={meal.id}>
              <button type="button" className="ftx-meal" onClick={() => onOpenMeal(meal.id)}>
                <span aria-hidden="true"><ClayIcon name="i-tanyer" size={28} /></span>
                <span className="ftx-meal-copy">
                  <strong>{mealDisplayName(meal) ?? 'Étkezés'}</strong>
                  <small>
                    {hhmmFromLoggedAt(meal.loggedAt, '—')} · {huInt(meal.kcal)} kcal
                  </small>
                </span>
                {meal.score != null && <b className="ftx-meal-score">{hu1(meal.score * 10)}</b>}
                <b aria-hidden="true">›</b>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Az étkezés-pont egy tizedessel, magyar vesszővel — 8,2 (prototípus `score1`). */
function huScore(n: number): string {
  return n.toLocaleString('hu-HU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function FuelTrendekPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const showingPrevious = searchParams.get(WEEK_PARAM) === PREV_WEEK_VALUE
  const thisMonday = mondayIso()
  const prevMonday = addDays(thisMonday, -7)

  const { start, weekDays, mealScoreAvg, weightAvgKg } = useFuelWeek(showingPrevious ? prevMonday : thisMonday)
  // C2: a MÚLT hét ugyanabból a heti végpontból, a `useFuelWeek` pontos query-kulcsával — a múlt
  // heti nézetben ez UGYANAZ a kulcs, amit a lap már olvas, tehát nincs második letöltés.
  const previous = useFuelWeekRollup(prevMonday)
  const previousHasData = previous.weekDays.some((d) => d.consumed.kcal > 0)
  // Amíg a valós olvasás nem oldódott fel, NEM állítjuk, hogy nincs korábbi hét.
  const previousKnownEmpty = !previous.isPending && !previousHasData
  const { week: meWeek } = useMeWeek(start)
  const { weeks: horizonWeeks } = useFuelHorizon(start)
  const { patterns } = usePatterns()
  const [openDate, setOpenDate] = useState<string | null>(null)

  // A nap AI pontja és az edzésnap-jelölés a MEGLÉVŐ napi értékelésből (új formula nélkül).
  const dayScores: Record<string, number | null> = {}
  const trainingDays: string[] = []
  const subscoresByDate: Record<string, { nutrition: number | null; quality: number | null }> = {}
  for (const d of meWeek?.days ?? []) {
    // A napok száma az ÉTKEZÉS-pont (0–10), nem a teljes napi értékelés (0–100): utóbbi az
    // alvást és az edzést is beleszámolja, tehát nem arról szól, amit ez a lap kérdez.
    dayScores[d.date] = mealDayScore(d.subscores.nutrition ?? null, d.subscores.quality ?? null)
    if (d.workoutCount > 0) trainingDays.push(d.date)
    subscoresByDate[d.date] = {
      nutrition: d.subscores.nutrition ?? null,
      quality: d.subscores.quality ?? null,
    }
  }

  const vm = buildWeekView({ start, days: weekDays, mealScoreAvg, weightAvgKg }, dayScores, trainingDays)
  const avgKcal = loggedKcalAvg(vm.days)

  // C2: a változás mindig a NYITOTT hét és az ELŐTTE álló hét különbsége — a prototípus szerint
  // (`fuel-pages.js:211`: `isCurrent?deltas[kind]:null`) a múlt heti nézetben nincs mihez mérni,
  // ezért ott egyetlen delta sem áll. Amíg a korábbi hét nem oldódott fel (vagy nincs egyetlen
  // naplózott napja sem), `null` — tehát nincs delta, nem nulla delta.
  // A korábbi hét VM-jéhez nem kell napi pont és edzésnap: a delták csak a három átlagot olvassák.
  const previousVm = showingPrevious || !previousHasData
    ? null
    : buildWeekView(
        {
          start: prevMonday,
          days: previous.weekDays,
          mealScoreAvg: previous.mealScoreAvg,
          weightAvgKg: previous.weightAvgKg,
        },
        {},
        [],
      )
  const deltas = weekDeltas(vm, previousVm)
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

  // C4: HIVATKOZÁSOK, nem másolatok. Felismerés nélkül a réteg csendben elmarad.
  const patternRefs = fuelPatternRefs(patterns)

  const openDay = openDate ? vm.days.find(d => d.date === openDate) ?? null : null
  const openRollup = openDate ? weekDays.find(d => d.date === openDate) ?? null : null

  return (
    <MozaikPage tone="sage" className="ftx-page">
      <EntranceGroup>
        <PageBody className="ftx-body">
          <div className="ftx-hero">
            <span className="ftx-glow" aria-hidden="true" />
            <h1>Trendek</h1>
            {/* A hét-váltó (prototípus `tx-weeknav`): a nyitott hét és a múlt hét között lép. */}
            <div className="ftx-weeknav">
              <button
                type="button"
                aria-pressed={showingPrevious}
                disabled={showingPrevious || previousKnownEmpty}
                onClick={() => setSearchParams({ [WEEK_PARAM]: PREV_WEEK_VALUE })}
              >
                ‹ Múlt hét
              </button>
              <strong className="ftx-week">{deriveWeekTitle(start === '' ? thisMonday : start)}</strong>
              <button
                type="button"
                aria-pressed={!showingPrevious}
                disabled={!showingPrevious}
                onClick={() => setSearchParams({})}
              >
                Ez a hét ›
              </button>
            </div>
            {/* Őszintén: új felhasználónál nincs korábbi hét — ez NORMÁL állapot, nem hiba. */}
            {!showingPrevious && previousKnownEmpty && (
              <p className="ftx-weeknav-note">Ez az első heted — még nincs korábbi hét, amire visszalépj.</p>
            )}
            <div className="ftx-big">
              <strong>{vm.loggedCount}</strong>
              <span>
                <b>/ 7 naplózott nap</b>
                <small>EBBŐL ÁLL A HETI KÉP</small>
              </span>
            </div>
            {/* A18/E11 (mezo-qt5q): a Kalauz „Mutasd meg a képernyőn" gombja erre a sávra
                mutat — a heti kép feltétel nélkül renderel, tehát a horgony sosem tűnik el. */}
            <div className="ftx-bars" data-kalauz-anchor="trendek-heti">
              {vm.days.map(day => (
                <WeekDayBar key={day.date} day={day} max={max} onOpen={() => setOpenDate(day.date)} />
              ))}
            </div>
            <p className="ftx-read">{read}</p>
            <p className="ftx-hint">A szám a nap pontja · koppints a részletekért</p>
          </div>

          <div className="ftx-tiles">
            <StatTile kind="avg" value={avgKcal} delta={deltas.avg} />
            {/* A heti étkezés-pont 0..1-ben érkezik; a 0–10-es skála a ház olvasata. A csempe
                neve `score`, a delta kulcsa `quality` — a prototípus szótára, egy helyen kötve. */}
            <StatTile
              kind="score"
              value={vm.mealScoreAvg == null ? null : vm.mealScoreAvg * 10}
              delta={deltas.quality}
            />
            <StatTile kind="weight" value={vm.weightAvgKg} delta={deltas.weight} />
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

          {patternRefs.length > 0 && (
            <>
              <h2 className="ftx-section">Mintázatok</h2>
              <div className="ftx-patterns">
                {patternRefs.map(ref => (
                  <button
                    key={ref.pairKey}
                    type="button"
                    className="ftx-pattern"
                    onClick={() => navigate(ref.route)}
                  >
                    <span className="ftx-pattern-art" aria-hidden="true">
                      <ClayIcon name="i-minta" size={36} />
                    </span>
                    <span className="ftx-pattern-copy">
                      <strong>{ref.title}</strong>
                      <small>{ref.stateLabel}</small>
                    </span>
                    <b aria-hidden="true">↗</b>
                  </button>
                ))}
              </div>
              <p className="ftx-note">
                A mintázatok otthona a Mezo — innen odalépsz, nem másolatot látsz.
              </p>
            </>
          )}
        </PageBody>
      </EntranceGroup>

      {openDay && openRollup && (
        <FuelWeekDayGlass
          day={openDay}
          rollup={openRollup}
          subscores={subscoresByDate[openDay.date] ?? { nutrition: null, quality: null }}
          onClose={() => setOpenDate(null)}
        >
          <DayMealList
            date={openDay.date}
            onOpenMeal={(mealId) => { setOpenDate(null); navigate(`/fuel/etkezes/${mealId}?d=${openDay.date}`) }}
          />
        </FuelWeekDayGlass>
      )}
    </MozaikPage>
  )
}
