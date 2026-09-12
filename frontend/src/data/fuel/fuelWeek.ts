import type {
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


