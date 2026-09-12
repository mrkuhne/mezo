// ============================================================
// Mezo · fuelWeekView — a Trendek heti képének view-modellje (Fuel Titanium S3, mezo-83g0;
// manifeszt C1 heti ritmus · C5 napi minőség · C6 edzésnapok).
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-state.js
// `weekSummary` / `weekCompare` + fuel-pages.js `weekBars` (:192). Ez a fájl a PROTOTÍPUS
// SZÁMOLÁSA, ház-adatokkal: a prototípus napjai kézzel hordoztak `kcal: null`-t és
// `weekend: true`-t; a valódi 7 napos rollup (`FuelWeekData`) egyiket sem hordozza, ezért
// mindkettő itt származik — a hétvége a VALÓDI dátumból, a „nincs naplózva" pedig abból, hogy a
// szerződés `FuelDayRollup`-ja a nullás `consumed`-en kívül semmilyen naplózás-jelzőt nem ad.
//
// ŐSZINTE-NULL, ez a fájl lényege:
//   • egy nem naplózott nap `kcal`/`pct`/`dayScore` NULL — nem nulla, és KIMARAD minden átlagból,
//   • keret nélküli nap `pct` NULL (nullával nem osztunk), és nem számít bele az átlagba,
//   • egyetlen naplózott nap nélkül MINDEN átlag null — a csempék „—"-t írnak.
//
// SZÉGYENMENTES: a keret felett járó nap `over: true`, ami ÁLLAPOT, nem hiba. A VM-ben nincs
// „error"/„hiba" jelző, mert a nézetnek nem szabad ilyet rajzolnia (a prototípus `overBudget`-je
// is csak egy MÁS színt választ, nem hibát).
// ============================================================
import { huDow } from '@/shared/lib/dates'
import type { FuelWeekData } from '@/data/fuel/mealApi'

/** Mennyivel fölötte kell járni a keretnek, hogy „keret felett"-nek olvassuk — a prototípus
 *  `overBudget`-je (`d.kcal > d.target + 60`). Egy hajszálnyi túllépés nem külön állapot. */
const OVER_TOLERANCE_KCAL = 60

export interface WeekDayVM {
  date: string
  /** Rövid magyar napnév a VALÓDI dátumból (Sze ≠ Szo — a ház `huDow`-ja). */
  label: string
  weekend: boolean
  /** Naplózott kalória — NULL, ha a napon nincs naplózva semmi. */
  kcal: number | null
  targetKcal: number | null
  /** A keret kihasználása százalékban — NULL naplózás vagy keret nélkül. */
  pct: number | null
  /** A nap AI értékelése (a hat dimenziós napi motor pontszáma) — NULL, ha nincs értékelés. */
  dayScore: number | null
  logged: boolean
  training: boolean
  /** A keret FELETT jár. Állapot, nem hiba — a nézet más színt ad neki, nem hibajelzést. */
  over: boolean
}

export interface WeekViewVM {
  days: WeekDayVM[]
  loggedCount: number
  weekdayAvgPct: number | null
  weekendAvgPct: number | null
  mealScoreAvg: number | null
  weightAvgKg: number | null
}

/** Naplózott napok kerethez mért átlaga — `null`, ha egyetlen használható nap sincs. */
function avgPct(days: WeekDayVM[]): number | null {
  const usable = days.filter((d): d is WeekDayVM & { pct: number } => d.pct != null)
  if (usable.length === 0) return null
  return usable.reduce((sum, d) => sum + d.pct, 0) / usable.length
}

/** A naplózott napok kalória-átlaga — `null`, ha egyetlen nap sincs naplózva (a csempe „—"-t ír).
 *  A nem naplózott nap NEM nulla: egyszerűen nincs benne az átlagban. */
export function loggedKcalAvg(days: WeekDayVM[]): number | null {
  const logged = days.filter((d): d is WeekDayVM & { kcal: number } => d.kcal != null)
  if (logged.length === 0) return null
  return logged.reduce((sum, d) => sum + d.kcal, 0) / logged.length
}

/** A hét napja a VALÓDI dátumból (0 = vasárnap) — a tömbpozíció nem hitelforrás. */
function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return dow === 0 || dow === 6
}

/**
 * A 7 napos rollup + a napi értékelések + az edzésnapok → a heti kép VM-je.
 *
 * `dayScores` a MEGLÉVŐ hat dimenziós napi értékelés pontszáma ISO dátum szerint (a
 * `/api/me/week/{start}` rollup `MeWeekDay.score`-ja) — ez a fájl NEM számol új pontszámot, és
 * skálafüggetlen: amit kap, azt adja tovább.
 * `trainingDays` az edzést hordozó napok ISO dátumai (C6).
 */
export function buildWeekView(
  week: FuelWeekData,
  dayScores: Record<string, number | null>,
  trainingDays: string[],
): WeekViewVM {
  const training = new Set(trainingDays)
  const days: WeekDayVM[] = week.days.map((d) => {
    // A szerződés `FuelDayRollup`-ja nem hordoz „naplózva" jelzőt: a nullás kalória az EGYETLEN
    // jelzés, amiből a hiány kiolvasható. Ezt itt egy helyen mondjuk ki, hogy ne szóródjon szét.
    const logged = d.consumed.kcal > 0
    const targetKcal = d.targets.kcal > 0 ? d.targets.kcal : null
    const pct = logged && targetKcal != null ? (d.consumed.kcal / targetKcal) * 100 : null
    return {
      date: d.date,
      label: huDow(d.date),
      weekend: isWeekend(d.date),
      kcal: logged ? d.consumed.kcal : null,
      targetKcal,
      pct,
      dayScore: dayScores[d.date] ?? null,
      logged,
      training: training.has(d.date),
      over: logged && targetKcal != null && d.consumed.kcal > targetKcal + OVER_TOLERANCE_KCAL,
    }
  })

  return {
    days,
    loggedCount: days.filter((d) => d.logged).length,
    weekdayAvgPct: avgPct(days.filter((d) => !d.weekend)),
    weekendAvgPct: avgPct(days.filter((d) => d.weekend)),
    mealScoreAvg: week.mealScoreAvg,
    weightAvgKg: week.weightAvgKg,
  }
}
