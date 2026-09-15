import { addDays } from '@/shared/lib/dates'
import type { FuelWeekData } from '@/data/fuel/mealApi'
import type {
  MacroSet,
  MedCycleDayCell,
  GymScheduleDay,
  WeeklySupplementRow,
  RecurringPattern,
  WeeklyStats,
} from '@/data/types'

// fuel-plan.jsx FuelPlanPage header title (55) — the mock demo week; real mode date-derives.
export const weekTitle = 'Máj 18 – 24'

// fuel-plan.jsx FuelPlanPage stats-card Mezo note (81–84) — hand-authored coach prose;
// real mode returns null (the generated weekly note is proactive-epic work).
export const weeklyNote =
  'Most kell egy **középmagas-protein héttel** menni — a hét közepén a legalacsonyabb az étvágy.'

// Medication cycle strip (mezo-lwmq): the owner tracks NO medication — an empty week, same as
// the real-mode ghost. FuelPlanPage's `medCycleWeek.length > 0` gate hides the cycle card in
// BOTH modes now, consistent with FuelMedicationPage's "Nincs aktív gyógyszer" empty state.
// Tests that need the populated strip drive it from an explicit fixture instead.
export const medCycleWeek: MedCycleDayCell[] = []

// fuel-plan.jsx WeeklySupplementGrid DAYS (404) — duplicate 'Sz' = Szerda + Szombat
export const DAYS_HU = ['H', 'K', 'Sz', 'Cs', 'P', 'Sz', 'V'] as const

// data.js gymSchedule.weeklyTimes (325–333)
export const gymSchedule: GymScheduleDay[] = [
  { day: 'Hét', type: 'Push Day', time: '07:30', duration: 75, active: true },
  { day: 'Kedd', type: 'Legs', time: '07:30', duration: 75, active: true },
  { day: 'Sze', type: 'Pull Day', time: '07:30', duration: 75, active: true },
  { day: 'Csü', type: 'Pull Day', time: '07:30', duration: 78, active: true, today: true },
  { day: 'Pén', type: 'Push · light', time: '07:30', duration: 60, active: true },
  { day: 'Szo', type: null, time: null, duration: null, active: false },
  { day: 'Vas', type: null, time: null, duration: null, active: false },
]

// fuel-plan.jsx WeeklySupplementGrid schedule (406–416)
export const weeklySupplements: WeeklySupplementRow[] = [
  { name: 'Kreatin', dose: '5g', days: [1, 1, 1, 1, 1, 1, 1], color: 'var(--coral)' },
  { name: 'D3 + K2', dose: '4000IU', days: [1, 1, 1, 1, 1, 1, 1], color: 'var(--info)' },
  { name: 'Magnézium', dose: '300mg', days: [1, 1, 1, 1, 1, 1, 1], color: 'var(--cat-preference)' },
  { name: 'Omega-3', dose: '2g', days: [1, 1, 1, 1, 1, 1, 1], color: 'var(--cat-physiology)' },
  { name: 'Whey · pre/post', dose: '30-40g', days: [1, 1, 1, 1, 1, 0, 0], color: 'var(--cat-tendency)' },
  { name: 'AAKG (pre-gym)', dose: '6g', days: [1, 1, 1, 1, 1, 0, 0], color: 'var(--warning)' },
  { name: 'Beta-Alanin', dose: '3g', days: [1, 1, 1, 1, 1, 0, 0], color: 'var(--warning)' },
  { name: 'Koffein 200', dose: '1×', days: [0, 0, 1, 0, 1, 0, 0], color: 'var(--warning)', note: 'PR-attempt napokon' },
]

// fuel-plan.jsx FuelPlanPage PatternRow instances (175–199)
export const recurringPatterns: RecurringPattern[] = [
  {
    icon: 'train',
    color: 'var(--cat-tendency)',
    title: 'H · Sze · P · 18:15 volleyball',
    detail:
      'Kitchen close 21:30-kor kötelező · vacsora 19:30-20:00. Pattern P2 megerősítve · ezen napokon az alvás-onset historikusan +24 perc ha későbbre csúszik a vacsora.',
  },
  {
    icon: 'fuel',
    color: 'var(--coral)',
    title: 'Reggeli gym (Mon-Pén 07:30)',
    detail:
      'Pre-workout snack 06:15-20-kor · banán + 20g whey · gyors-szénhidrát. Post-workout reggeli 09:00-09:15 (Túrós zabkása vagy tojásrántotta) — slow-release glikogén-pótlás.',
  },
  {
    icon: 'pill',
    color: 'var(--warning)',
    title: 'Kedd · 17:00 vb után rövidebb ablak',
    detail:
      '13:00 ebéd + 16:00 quick snack · vacsora 19:30-20:00. Késő-ebéd-zóna stratégiai · nem ablakon kívül.',
  },
  {
    icon: 'anchor',
    color: 'var(--info)',
    title: 'Szombat · flexibilis',
    detail:
      'Random-időben volleyball mérkőzés · az aznapi étkezést post-hoc igazítjuk a meccs időpontjához. Saturday-only adaptív protokoll.',
  },
]

// fuel-plan.jsx FuelPlanPage weekly stats magic numbers (58–63)
export const weeklyStats: WeeklyStats = {
  kcalTarget: 3100,
  kcalAvgFactor: 0.91,
  proteinHitDays: 6,
  supplementsAdherence: 92,
}



// --- Trendek (Fuel Titanium S3, mezo-83g0) ---------------------------------------------------
// C1/C2: the mock 7-day rollup the weekly picture reads, PLUS the two weekly averages the
// backend computes (`FuelWeekResponse.mealScoreAvg` / `.weightAvgKg`) and the mapper used to
// drop. Shaped exactly like the contract: `consumed.kcal === 0` is the ONLY "nothing logged"
// signal the rollup carries, so two days are left at zero and the view reads them as
// honest-null, never as a zero-height bar.
//
// Re-dated to whatever Monday is requested (the `mockMeWeek` idiom) so the mock page shows
// "this week" on any clock. The shape stays fixed: 5 logged days (one over the budget, one
// partial) + 2 unlogged.
const ROLLUP_TARGET = { kcal: 2400, p: 160, c: 250, f: 75, water: 3000 }
const ROLLUP_WEEKEND_TARGET = { kcal: 2200, p: 150, c: 230, f: 70, water: 3000 }
/** `consumed` per weekday offset; `null` = that day has nothing logged (honest gap). */
const ROLLUP_CONSUMED: readonly (MacroSet | null)[] = [
  { kcal: 2115, p: 148, c: 220, f: 69, water: 2600 },
  { kcal: 2260, p: 154, c: 245, f: 74, water: 2100 },
  { kcal: 1180, p: 86, c: 132, f: 41, water: 1250 },
  null,
  { kcal: 2050, p: 112, c: 228, f: 68, water: 1600 },
  { kcal: 2740, p: 104, c: 318, f: 104, water: 1400 },
  null,
]
/** A KORÁBBI hét (`variant: 'past'`) saját, szintén determinisztikus alakja — C1/C2 hét-váltás és
 *  a hét-a-héthez delták (mezo-83g0). Szándékosan MÁS számok, mint a nyitott héten: ha a két hét
 *  ugyanaz volna, minden delta nullára kerekedne, és a „változás" tesztek vákuumba futnának.
 *  6 naplózott nap (egy hiányzó) — a nyitott hétnél magasabb átlag, jobb súly, rosszabb pontátlag. */
const ROLLUP_CONSUMED_PAST: readonly (MacroSet | null)[] = [
  { kcal: 2290, p: 152, c: 248, f: 76, water: 2400 },
  { kcal: 2180, p: 144, c: 236, f: 71, water: 2200 },
  { kcal: 2410, p: 158, c: 262, f: 79, water: 2700 },
  { kcal: 1960, p: 131, c: 208, f: 64, water: 1900 },
  null,
  { kcal: 2520, p: 139, c: 291, f: 88, water: 1700 },
  { kcal: 2260, p: 126, c: 254, f: 74, water: 2050 },
]
const ZERO_MACROS: MacroSet = { kcal: 0, p: 0, c: 0, f: 0, water: 0 }

/**
 * A mock 7 napos rollup a KÉRT hétfőre átdátumozva (soha nem beégetett dátum — éjfélkor sem
 * romlik el). `variant` dönti el, MELYIK determinisztikus hét alakját kapjuk: a `'current'` a
 * nyitott hét változatlan fixture-je (byte-stabil, a meglévő tesztek erre épülnek), a `'past'` a
 * korábbi hét saját alakja. A hívó (a `useFuelWeekRollup` hook) dönt, mert a „melyik hétfő a
 * mostani" kérdés a hook dolga — ez a seed-modul nem olvas órát.
 */
export function mockWeekRollup(start: string, variant: 'current' | 'past' = 'current'): FuelWeekData {
  const past = variant === 'past'
  return {
    start,
    days: (past ? ROLLUP_CONSUMED_PAST : ROLLUP_CONSUMED).map((consumed, i) => ({
      date: addDays(start, i),
      targets: i >= 5 ? ROLLUP_WEEKEND_TARGET : ROLLUP_TARGET,
      consumed: consumed ?? ZERO_MACROS,
    })),
    mealScoreAvg: past ? 0.71 : 0.78,
    weightAvgKg: past ? 81.9 : 81.3,
  }
}
