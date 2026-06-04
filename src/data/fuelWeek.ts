import type {
  RetaDayCell,
  GymScheduleDay,
  WeeklySupplementRow,
  RecurringPattern,
  ReplanScenario,
  StackRecommendation,
} from './types'

// fuel-plan.jsx RetaWeekStrip phases (227–235)
export const retaWeek: RetaDayCell[] = [
  { d: 1, label: 'Peak', color: 'var(--reta-d1)' },
  { d: 2, label: 'Peak', color: 'var(--reta-d2)' },
  { d: 3, label: 'Stable', color: 'var(--reta-d3)' },
  { d: 4, label: 'Stable', color: 'var(--reta-d4)' },
  { d: 5, label: 'Stable', color: 'var(--reta-d5)' },
  { d: 6, label: 'Trough', color: 'var(--reta-d6)' },
  { d: 7, label: 'Trough', color: 'var(--reta-d7)' },
]

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
  { name: 'Kreatin', dose: '5g', days: [1, 1, 1, 1, 1, 1, 1], color: 'var(--brand-glow)' },
  { name: 'D3 + K2', dose: '4000IU', days: [1, 1, 1, 1, 1, 1, 1], color: 'var(--info)' },
  { name: 'Magnézium', dose: '300mg', days: [1, 1, 1, 1, 1, 1, 1], color: 'var(--cat-preference)' },
  { name: 'Omega-3', dose: '2g', days: [1, 1, 1, 1, 1, 1, 1], color: 'var(--cat-physiology)' },
  { name: 'Whey · pre/post', dose: '30-40g', days: [1, 1, 1, 1, 1, 0, 0], color: 'var(--cat-tendency)' },
  { name: 'AAKG (pre-gym)', dose: '6g', days: [1, 1, 1, 1, 1, 0, 0], color: 'var(--warning)' },
  { name: 'Beta-Alanin', dose: '3g', days: [1, 1, 1, 1, 1, 0, 0], color: 'var(--warning)' },
  { name: 'Koffein 200', dose: '1×', days: [0, 0, 1, 0, 1, 0, 0], color: 'var(--warning)', note: 'PR-attempt napokon' },
  { name: 'Reta · hetente', dose: '6mg', days: [1, 0, 0, 0, 0, 0, 0], color: 'var(--error)' },
]

// fuel-plan.jsx FuelPlanView PatternRow instances (175–199)
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
    color: 'var(--brand-glow)',
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

// fuel-plan.jsx FuelPlanView weekly stats magic numbers (58–63)
export const weeklyStats = {
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
    color: 'var(--brand-glow)',
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

// fuel-stack.jsx STACK_RECOMMENDATIONS (300–328)
export const stackRecommendations: StackRecommendation[] = [
  {
    name: 'ZMA · Zinc + Mg + B6',
    source: 'myprotein.hu',
    price: '5 490 Ft',
    inStash: false,
    reason:
      'Heti 5 gym + 4 vb stacked load mellett a Zn-status historikusan +20% testreszabás · esti recovery-stack-ben helyett-cserélheti a magnézium-glicinátot.',
    metric: '+0.4 sleep quality',
    confidence: 0.74,
  },
  {
    name: 'Ashwagandha KSM-66',
    source: 'myprotein.hu',
    price: '8 990 Ft',
    inStash: false,
    reason:
      'MAV-fázis + magas heti volumen + Reta cycle együttesen cortisol-emelő. 600mg esti dózisban a HRV historikusan +6-8% — ezzel a load-dal ajánlott.',
    metric: '+6% HRV',
    confidence: 0.68,
  },
  {
    name: 'Citrullin Malát',
    source: 'myprotein.hu',
    price: '6 490 Ft',
    inStash: false,
    reason:
      'Az AAKG-pump-ot kiegészíti — pre-workout 6g citrullin + 3g AAKG együtt érdemibb vasoldilation. Pull Day-eken észrevehetően jobb pumpa.',
    metric: '+12% rep-out volume',
    confidence: 0.72,
  },
]
