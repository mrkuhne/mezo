import type { GoalTimelineResponse } from '@/data/me/goalLinkApi'
import type { GoalOverviewResponse, GoalResponse, FeasibilityPreviewResponse, GoalSuggestionResponse } from '@/data/me/goalApi'
import type { BiometricProfileResponse } from '@/data/me/biometricProfileApi'
import type { Goal, WeightEntry, WeightTrends, LinkedMeso } from '@/data/types'
import { addDays, localDateString } from '@/shared/lib/dates'
import { gapDays, lerpSeries } from '@/data/_seed/seedGap'

// ============================================================
// Súlynapló + trendek. A `goal.currentWeight` ebből származik, ezért a blokk a `goal`
// ELŐTT áll (modul-szintű kiértékelési sorrend — lejjebb TDZ-hibát adna).
// ============================================================
const weightLogFixed: WeightEntry[] = [
  { date: '2026-04-22', value: 81.4, note: 'Goal start · mély deficit indul' },
  { date: '2026-04-25', value: 81.0 },
  { date: '2026-04-28', value: 80.8 },
  { date: '2026-05-01', value: 80.5 },
  { date: '2026-05-04', value: 80.2, note: 'Első hét · étvágy stabil' },
  { date: '2026-05-07', value: 79.9 },
  { date: '2026-05-09', value: 79.7 },
  { date: '2026-05-11', value: 80.3, note: 'Volleyball szombat · folyadékvesztés kalibrálás' },
  { date: '2026-05-13', value: 79.5 },
  { date: '2026-05-15', value: 79.2 },
  { date: '2026-05-17', value: 79.0 },
  { date: '2026-05-19', value: 79.4, note: 'Hétfő reggeli súly nem reprezentatív' },
  { date: '2026-05-20', value: 78.9 },
  { date: '2026-05-21', value: 78.8 },
  { date: '2026-05-22', value: 78.6 },
]

// mezo-idz2: mai súly, hogy a DayOrb súly-jele mock módban is jelen legyen. Egy
// befagyasztott órájú vizuális futásban a „ma" egybeeshet egy meglévő fix sorral, ezért
// a beszúrás idempotens: csak akkor adjuk hozzá, ha erre a napra még nincs sor, majd a
// növekvő dátumsorrendet a beszúrás helyétől függetlenül explicit rendezéssel biztosítjuk.
// A skip-ág is MÁSOLATOT ad vissza: a `.sort()` helyben rendez, tehát a nyers ternary
// magát a modul-szintű `*Fixed` konstanst mutálná (mezo-tzid).
const todayIsoWeight = localDateString()
const TODAY_WEIGHT = 78.4
const lastFixedWeight = weightLogFixed[weightLogFixed.length - 1]

// mezo-7vdm #6: a fix farok (2026-05-22) és a mai sor közti napok kitöltése. Enélkül valós
// órán több hónapos lyuk maradt a sorozatban, és a /me/suly heti csoportosítása egyelemű
// legfrissebb hetet mutatott. A hídértékek a két végpont közt egyenletesen futnak, tehát
// determinisztikusak. Fagyasztott órán (2026-05-21) a fix farok már lefedi a mai napot, így
// a híd ÜRES — egyetlen vizuális golden sem mozdul ettől.
//
// A híd NEM egyenes vonal a két végpont közt: a fix farok (78.6) és a mai sor (78.4) alig
// 0.2 kg-ra van egymástól, tehát hónapokra elosztva a sorozat laposra ülne, és a felület
// „0,0 kg/hét" tempót mutatna — a demó szempontjából rosszabb, mint a lyuk volt. Ehelyett
// egy elmondható ívet ad: visszahízás a nyári deficit után, hosszú plató, majd egy friss,
// négyhetes vágás a mai értékig. Így a 7 napos és a 4 hetes tempó is beszédes marad.
const PLATEAU_WEIGHT = 79.4
const CUT_DAYS = 28
const RISE_DAYS = 14

const bridge: WeightEntry[] = (() => {
  const days = gapDays(lastFixedWeight.date, todayIsoWeight)
  const n = days.length
  // Rövid lyukra (és a fagyasztott órájú futásokra, ahol n = 0) nincs mit formázni: a
  // két végpont közti egyenes az egyetlen értelmes kitöltés.
  const values = n <= CUT_DAYS
    ? lerpSeries(lastFixedWeight.value, TODAY_WEIGHT, n)
    : [
        ...lerpSeries(lastFixedWeight.value, PLATEAU_WEIGHT, Math.min(RISE_DAYS, n - CUT_DAYS)),
        ...Array(n - CUT_DAYS - Math.min(RISE_DAYS, n - CUT_DAYS)).fill(PLATEAU_WEIGHT),
        ...lerpSeries(PLATEAU_WEIGHT, TODAY_WEIGHT, CUT_DAYS),
      ]
  return values.map((value, i) => ({ date: days[i], value }))
})()

export const weightLog: WeightEntry[] = (
  weightLogFixed.some((w) => w.date === todayIsoWeight)
    ? [...weightLogFixed, ...bridge]
    : [...weightLogFixed, ...bridge, { date: todayIsoWeight, value: TODAY_WEIGHT }]
).sort((a, b) => a.date.localeCompare(b.date))

// mezo-7vdm #6: a trendek a NAPLÓBÓL származnak, nem kézzel írt literálból. Korábban a
// `currentWeight` (78.6) és a `last7d.avg` (78.96) a fix farokhoz igazodott, a legfrissebb
// naplósor viszont 78.4 volt — a felület három különböző számot állított ugyanarról.
// Mock-only: real módban a trendeket az API adja (weightHooks.ts), ide sosem esik vissza.
function weeklyRateOver(days: number): number {
  const cutoff = addDays(todayIsoWeight, -days)
  const window = weightLog.filter((w) => w.date >= cutoff)
  if (window.length < 2) return 0
  const first = window[0]
  const last = window[window.length - 1]
  const span = (Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / 86_400_000
  if (span <= 0) return 0
  return Math.round(((last.value - first.value) / span) * 7 * 10) / 10
}

function avgOver(days: number): number {
  const cutoff = addDays(todayIsoWeight, -days)
  const window = weightLog.filter((w) => w.date >= cutoff)
  if (window.length === 0) return 0
  return Math.round((window.reduce((a, w) => a + w.value, 0) / window.length) * 100) / 100
}

/** A napló legfrissebb DÁTUMÚ sora — nem feltétlenül a „mai": fagyasztott órán a fix farok
 *  (2026-05-22) a mai nap UTÁN van, és akkor az a legfrissebb. */
const latestWeight = weightLog[weightLog.length - 1].value

export const weightTrends: WeightTrends = {
  last7d: { avg: avgOver(7), weeklyRate: weeklyRateOver(7) },
  last4w: { weeklyRate: weeklyRateOver(28) },
}

export const linkedMesocycles: Record<string, LinkedMeso> = {
  'meso-hyp-04': { id: 'meso-hyp-04', shortTitle: 'Hypertrophy 04', status: 'active', startDate: 'Máj 1', endDate: 'Jún 12', weeks: 6 },
  'meso-str-02': { id: 'meso-str-02', shortTitle: 'Strength 02', status: 'planned', startDate: 'Jún 16', endDate: 'Aug 4', weeks: 7 },
  'meso-maint-01': { id: 'meso-maint-01', shortTitle: 'Maintenance', status: 'planned', startDate: 'Aug 7', endDate: 'Aug 28', weeks: 3 },
}

// Static mock timeline — Decision A (G4b). Mirrors `linkedMesocycles` (the three
// gym mesocycles as `mesocycle` links) and adds a sample `running_block` link +
// an uncovered gym-lane gap so the GoalTimeline lane component renders the same
// lanes/gaps in mock mode as in real mode. `goalId` + `weeks` track the mock goal
// window (Ápr 1 → Aug 15 ≈ 20 weeks). ISO dates here — `useGoal`/the lane format
// them, matching how real `GoalTimelineResponse` arrives from the backend.
export const goal: Goal = {
  id: 'goal-cut-2026',
  title: 'Fogyás · Nyári forma',
  kind: 'cut',
  status: 'active',
  startWeight: 81.4,
  // mezo-7vdm #6: a naplóból származik, nem kézzel írt literál. Korábban 78.6 volt (a fix
  // farok utolsó sora), miközben a legfrissebb naplósor 78.4 — a felület három különböző
  // számot állított ugyanarról a súlyról.
  currentWeight: latestWeight,
  targetWeight: 73.0,
  // Target/cél pace is %BW/week (mirrors goalResponse.rateTargetPctPerWeek below) —
  // a DIFFERENT quantity from the observed kg/hét trend the hero shows (mezo-5om).
  rateTarget: { value: 0.6, unit: '%/hét', direction: 'down' },
  mesocycles: ['meso-hyp-04', 'meso-str-02', 'meso-maint-01'],
  identityFrame: 'Egészséges erő · nem csak alak — a teljes energiám jobb 73kg-on a mély deficit után.',
  // Day-planner settings (Fuel P5) — the eating-occasion count + wake/bed anchors
  // the fuel timeline plans around. Editable via EditGoalSheet's "Napi ritmus".
  mealsPerDay: 4,
  wakeTime: '06:00',
  bedTime: '23:00',
}

// Mock raw GoalResponse — the G4b command-center hero reads the contract shape
// (trajectory/guards/window/weights) directly, so mock mode supplies the same
// envelope the backend returns. ISO dates here; the hero formats them via huMonthDay.
export const goalResponse: GoalResponse = {
  id: goal.id,
  title: goal.title,
  trajectory: 'cut',
  guards: ['strength', 'muscle'],
  status: 'active',
  startDate: '2026-04-01',
  targetDate: '2026-08-15',
  startWeightKg: goal.startWeight,
  targetWeightKg: goal.targetWeight,
  rateTargetPctPerWeek: 0.6,
  identityFrame: goal.identityFrame,
  // Day-planner settings (Fuel P5) — mirror the domain goal above so mock mode
  // supplies the same envelope the backend round-trips (GoalResponse shape).
  mealsPerDay: goal.mealsPerDay ?? undefined,
  wakeTime: goal.wakeTime ?? undefined,
  bedTime: goal.bedTime ?? undefined,
  // Slice 5: no adaptive correction accepted in the mock baseline.
  balanceAdjustmentKcal: undefined,
  // G5 engine output (mock) — a feasible-with-warnings verdict + two recept
  // segments (deficit during the gym blocks, taper near the target) + the guard
  // status the recept card renders. Mirrors the GoalPrescription contract so the
  // card renders offline in mock mode without a backend evaluate. (mezo-g1u)
  // NEAT model (mezo-eujg): maintenance = bmr×neat = 2064 (neatBaselineKcal); tdee = neatBaselineKcal +
  // weeklyEatKcalPerDay (scheduled training ÷ 7). Fuel's dynamic day-plan reads bmr+neat off this envelope.
  tdeeBootstrap: { bmr: 1720, neat: 1.2, neatBaselineKcal: 2064, weeklyEatKcalPerDay: 602, tdee: 2666, formula: 'MSJ', computedAt: '2026-05-22T06:00:00Z' },
  prescription: {
    generatedAt: '2026-05-22T06:05:00Z',
    basis: 'formula',
    segments: [
      {
        fromWeek: 1,
        toWeek: 12,
        label: 'Mély deficit',
        kcal: 2150,
        // Day-type shift (mezo-sxlj): mock's dayTypeShiftKcal is 200, T=4/R=3 mock schedule,
        // no floor bite — trainingDayKcal/restDayKcal demo the split even though the diet-settings
        // ghost itself stays at 0 (drift guard vs the BE config default).
        trainingDayKcal: 2300,
        restDayKcal: 1950,
        proteinG: 163,
        carbsG: 226,
        fatG: 66,
        sleepTargetH: 7.5,
        restDays: [3, 7],
        projectedRateKgPerWk: -0.55,
        dailyEnergyBalanceKcal: -516,
        rationale: 'Ebben a szakaszban agresszívabb deficit fér bele — a fehérje magasan tartja az izmot, az alvás védi a regenerációt.',
      },
      {
        fromWeek: 13,
        toWeek: 20,
        label: 'Lassú befutó · taper',
        kcal: 2380,
        trainingDayKcal: 2530,
        restDayKcal: 2180,
        proteinG: 155,
        carbsG: 276,
        fatG: 73,
        sleepTargetH: 8,
        restDays: [4, 7],
        projectedRateKgPerWk: -0.35,
        dailyEnergyBalanceKcal: -286,
        rationale: 'A célsúly közeledtével lassítunk, hogy az erő-gardot ne sértsük és a forma stabil maradjon a deadline-ra.',
      },
    ],
    guardStatus: {
      strength: {
        active: true,
        e1rmTrendPct: 1.2,
        breached: false,
        notes: ['Az e1RM trend pozitív — a deficit eddig nem nyomta le az erőt.'],
      },
      muscle: {
        active: true,
        minWeeklySetsPerMuscle: 8,
        belowMaintenanceMuscles: [],
        rateWithinCap: true,
        proteinMonitored: false,
        notes: ['Minden izomcsoport eléri a heti 8 fenntartó szettet.'],
      },
    },
    feasibility: {
      verdict: 'feasible-with-warnings',
      notes: ['A tempó a cap közelében van — a befutóban lassítunk.', 'A fehérje-cél Fuel-logolás nélkül még nem ellenőrzött.'],
    },
  },
}

// Open diet-phase + weekly-correction suggestions (slice 4 + slice 5) — mock mode
// renders both proposed cards so the GoalsPage suggestion surface + Fuel banner
// demo both kinds offline. Accept/dismiss no-op.
export const goalSuggestions: GoalSuggestionResponse[] = [
  {
    id: 'sug-deload-w3',
    kind: 'phase_change',
    status: 'proposed',
    payload: {
      reason: 'Deload hét (W3) — a regeneráció többet ér, ha ezen a héten tartáson eszel.',
      suggestedTrajectory: null,
      balanceOverrideKcal: 0,
      fromWeek: 3,
      toWeek: 3,
      mesoId: null,
      mesoTitle: null,
      snapshotTrajectory: 'cut',
    },
    createdAt: '2026-05-22T06:10:00Z',
    decidedAt: null,
  },
  {
    id: 'sug-weekly-w17',
    kind: 'weekly_correction',
    status: 'proposed',
    payload: {
      // Note: adherenceAvgTargetKcal is nudged off the brief's literal 2150 (kept
      // exact in GoalSuggestionCard.test.tsx's own fixture) so GoalsPage.test.tsx's
      // /2150/ assertion (the mock prescription's segment kcal) stays unambiguous
      // with this card rendering on the same page.
      reason:
        'A mért trend -0.20 kg/hét, a cél -0.48 kg/hét — a heti felülvizsgálat -60 kcal/nap csökkentést javasol. Az alváshiány miatt a deficit-mélyítés a felére tompítva.',
      weekStart: '2026-08-24',
      deltaKcal: -120,
      observedRateKgPerWk: -0.2,
      targetRateKgPerWk: -0.48,
      dampedBySleep: true,
      adherenceLoggedDays: 5,
      adherenceAvgIntakeKcal: 2210,
      adherenceAvgTargetKcal: 2160,
      prescriptionGeneratedAt: '2026-08-20T06:00:00Z',
    },
    createdAt: '2026-08-24T06:10:00Z',
    decidedAt: null,
  },
]

/** Full contract-shaped Goal Overview seed. Mock and real surfaces deliberately consume the
 * same server vocabulary; only the transport differs. The split-day values mirror the current
 * prescription above, and the plan rows mirror `goalTimeline` below. */
export const goalOverviewSeed: GoalOverviewResponse = {
  goalId: goal.id,
  title: goal.title,
  trajectory: 'cut',
  status: 'active',
  currentWeek: 8,
  totalWeeks: 20,
  completionPct: 33,
  currentWeightKg: goal.currentWeight,
  targetWeightKg: goal.targetWeight,
  remainingKg: goal.currentWeight - goal.targetWeight,
  courseStatus: 'on_track',
  courseReasonCode: 'rate_on_track',
  observedRateKgPerWeek: -0.5,
  targetRateKgPerWeek: -0.48,
  projectedTargetDate: '2026-08-14',
  dataSufficiency: 'full',
  diet: {
    weekAverageKcal: 2150,
    todayDayType: 'training',
    todayKcal: 2300,
    trainingDayKcal: 2300,
    restDayKcal: 1950,
    proteinG: 163,
    carbsG: 226,
    fatG: 66,
    basis: 'formula',
    explanationCode: 'training_day_split',
  },
  segment: {
    available: true,
    label: 'MAV',
    fromWeek: 5,
    toWeek: 10,
    remainingDays: 5,
    nextLabel: 'Strength 02',
    nextFromWeek: 11,
    nextChangeDate: '2026-06-16',
    explanationCode: 'mesocycle_phase',
  },
  plans: {
    links: [
      {
        id: 'link-hyp-04',
        planType: 'mesocycle',
        planId: 'meso-hyp-04',
        startWeek: 5,
        endWeek: 10,
        plan: { title: 'Hypertrophy 04', status: 'active', startDate: '2026-05-01', endDate: '2026-06-12', weeks: 6 },
      },
      {
        id: 'link-run-01',
        planType: 'running_block',
        planId: 'run-base-01',
        startWeek: 6,
        endWeek: 13,
        plan: { title: 'Base Build · 5K', status: 'active', startDate: '2026-05-08', endDate: '2026-07-03', weeks: 8 },
      },
    ],
    gaps: [{ fromWeek: 1, toWeek: 4 }],
    sportSchedule: [
      { id: 'sport-bvsc-tue', dayOfWeek: 1, time: '18:30', durationMin: 90, kind: 'training', location: 'BVSC', sport: 'volleyball' },
      { id: 'sport-bvsc-fri', dayOfWeek: 4, time: '18:30', durationMin: 90, kind: 'training', location: 'BVSC', sport: 'volleyball' },
    ],
    activeLinkCount: 2,
    uncoveredWeekCount: 4,
    topIssueCode: 'mesocycle_gap',
  },
  guards: {
    status: {
      strength: { active: true, e1rmTrendPct: 1.2, breached: false, notes: ['Az erőtrend stabil.'] },
      muscle: {
        active: true,
        minWeeklySetsPerMuscle: 8,
        belowMaintenanceMuscles: [],
        rateWithinCap: true,
        proteinMonitored: false,
        notes: ['A volumen fedezi a fenntartó minimumot.'],
      },
    },
    healthyCount: 3,
    totalCount: 4,
    topIssueCode: 'protein_unmonitored',
  },
  openSuggestionCount: 1,
  latestSuggestionId: 'sug-weekly-w17',
}

// Static biometric profile for mock mode (G6, mezo-06n) — a complete profile so
// the Profile Biometria card + the goal-creation gate render offline without a
// backend. The derived base-TDEE line on the card reads `tdeeBootstrap`; the
// editor sheet prefills from these fields. (Katch → uses bodyFatPct.)
export const biometricProfile: BiometricProfileResponse = {
  sex: 'M',
  heightCm: 180,
  birthDate: '1991-03-01',
  bodyFatPct: 15,
  activityLevel: 'MIXED',
  // NEAT model (mezo-eujg): neatBaselineKcal = bmr × neat (1910 × 1.35 ≈ 2579);
  // tdee = neatBaselineKcal + weeklyEatKcalPerDay (scheduled training ÷ 7).
  tdeeBootstrap: { bmr: 1910, neat: 1.35, neatBaselineKcal: 2579, weeklyEatKcalPerDay: 421, tdee: 3000, formula: 'KATCH', computedAt: '2026-05-22T06:00:00Z' },
}

// Static realism preview for mock mode (G6, mezo-06n) — a feasible draft so the
// cél step's live feasibility panel renders offline without a backend. The
// aggressive branch (suggestedTargetDate present) is exercised via MSW in real
// mode; mock mode always shows the safe-band state.
export const feasibilityPreview: FeasibilityPreviewResponse = {
  derivedRatePctPerWeek: 0.6,
  withinSafeBand: true,
  verdict: 'feasible',
}

export const goalTimeline: GoalTimelineResponse = {
  goalId: goal.id,
  weeks: 20,
  links: [
    {
      id: 'link-hyp-04',
      planType: 'mesocycle',
      planId: 'meso-hyp-04',
      startWeek: 5,
      endWeek: 10,
      plan: { title: 'Hypertrophy 04', status: 'active', startDate: '2026-05-01', endDate: '2026-06-12', weeks: 6 },
    },
    {
      id: 'link-str-02',
      planType: 'mesocycle',
      planId: 'meso-str-02',
      startWeek: 11,
      endWeek: 17,
      plan: { title: 'Strength 02', status: 'planned', startDate: '2026-06-16', endDate: '2026-08-04', weeks: 7 },
    },
    {
      id: 'link-maint-01',
      planType: 'mesocycle',
      planId: 'meso-maint-01',
      startWeek: 18,
      endWeek: 20,
      plan: { title: 'Maintenance', status: 'planned', startDate: '2026-08-07', endDate: '2026-08-28', weeks: 3 },
    },
    {
      id: 'link-run-01',
      planType: 'running_block',
      planId: 'run-base-01',
      startWeek: 6,
      endWeek: 13,
      plan: { title: 'Base Build · 5K', status: 'active', startDate: '2026-05-08', endDate: '2026-07-03', weeks: 8 },
    },
  ],
  gaps: [{ fromWeek: 1, toWeek: 4 }],
}
