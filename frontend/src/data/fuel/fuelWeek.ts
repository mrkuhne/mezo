import type {
  MedCycleDayCell,
  GymScheduleDay,
  WeeklySupplementRow,
  RecurringPattern,
  ReplanScenario,
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

// pantry-data.js replanScenarios (559–631)
export const replanScenarios: ReplanScenario[] = [
  {
    id: 'vb-cancelled',
    title: 'Volleyball lemondva',
    detail: 'Edző írt · Hétfő 18:15 vb elmarad',
    icon: 'today',
    color: 'var(--cat-tendency)',
    cascades: [
      { system: 'Fuel', impact: 'Vacsora −30p', detail: '21:00 → 20:30 · kitchen close vissza 21:00-ra' },
      { system: 'Fuel', impact: 'Magnézium változatlan', detail: '21:00 stack marad · alvás-onset target nem mozdul' },
      { system: 'Train', impact: 'Push Day +1 set', detail: 'Free vb-load · többlet-volumen behozható a Push Day-en' },
      { system: 'Sleep', impact: 'Bedtime −15p', detail: 'Vacsora előbb → sleep onset 22:45 felé tolódik' },
    ],
    tools: [
      { type: 'compute', name: 'recomputeKitchenClose()' },
      { type: 'compute', name: 'redistributeVolume(muscle=back)' },
      { type: 'write', name: 'updateActiveProtocol(v+1)' },
    ],
    confidence: 0.88,
  },
  {
    id: 'gym-delayed',
    title: 'Gym csúszik · késik a busz',
    detail: '07:30 → 08:30 gym indítás',
    icon: 'train',
    color: 'var(--coral)',
    cascades: [
      { system: 'Fuel', impact: 'AAKG-stack 07:50', detail: 'T-40 visszaszámolva · pre-snack 07:20' },
      { system: 'Fuel', impact: 'Reggeli 10:15', detail: 'Post-workout slot tolva · ebéd 13:30-ra' },
      { system: 'Fuel', impact: 'Coffee window szűkül', detail: '12:00 espresso → 13:00 · 14:00 cutoff előtt épp megfér' },
    ],
    tools: [
      { type: 'compute', name: 'shiftPreWorkoutChain(+60min)' },
      { type: 'compute', name: 'validateCoffeeCutoff()' },
    ],
    confidence: 0.91,
  },
  {
    id: 'extra-vb',
    title: 'Extra vb · meccs hozzáadva',
    detail: 'Szombat extra meccs 16:00',
    icon: 'today',
    color: 'var(--cat-tendency)',
    cascades: [
      { system: 'Fuel', impact: 'Pre-game snack 14:00', detail: '60-80g carb · banán + rizs · whey 20g' },
      { system: 'Fuel', impact: 'Vacsora 19:30', detail: 'Post-meccs · omega-3 stack · kitchen close 21:30' },
      { system: 'Train', impact: 'Vasárnapi Push light', detail: 'Csak ha az RPE <7.5 a meccsen' },
    ],
    tools: [
      { type: 'read', name: 'get_sport_load(7d)' },
      { type: 'compute', name: 'buildSatelliteMeals(event)' },
    ],
    confidence: 0.79,
  },
  {
    id: 'missed-supp',
    title: 'Magnézium kihagyva tegnap',
    detail: 'Esti slot · 21:00 stack pending maradt',
    icon: 'pill',
    color: 'var(--warning)',
    cascades: [
      { system: 'Fuel', impact: 'Ma esti dupla NEM', detail: 'Mg-glicinát nem halmozódik · csak a mai dózis' },
      { system: 'Sleep', impact: 'Pattern P2 megfigyelve', detail: 'Tegnap éjszaka quality 7.0 — várt 7.4 · Mg-stack hiánya korrelál' },
      { system: 'Insights', impact: 'Adherence chart frissül', detail: 'Mg stack heti adherence 100% → 86%' },
    ],
    tools: [
      { type: 'read', name: 'get_last_supplement_state()' },
      { type: 'read', name: 'get_pattern_correlation(P2)' },
      { type: 'write', name: 'logSupplementSkip(reason=missed)' },
    ],
    confidence: 0.95,
  },
]

