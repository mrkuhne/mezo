import { http, HttpResponse } from 'msw'
import { API_BASE } from '@/data/_client/api'
import { initialChat, cannedReply } from '@/data/insights/chat'
import { facts as knowledgeSeed, candidateSeed } from '@/data/insights/knowledge'
import { patterns as patternSeed } from '@/data/insights/insights'
import { notificationPrefSeed } from '@/data/notification/notificationMock'
import { ADMIN_INVITES_MOCK, ADMIN_USERS_MOCK } from '@/data/admin/adminMock'
import { addDays } from '@/shared/lib/dates'
import { MOCK_DIMENSIONS, MOCK_EXPERTS, MOCK_OVERVIEW_EMPTY, MOCK_RUNS, MOCK_RUN_DETAIL } from '@/data/character/characterMock'
import { MOCK_LIFE_GOALS, MOCK_SIGNAL_CATALOG, mockPropose, mockProgress, mockToday } from '@/data/lifegoal/lifegoalMock'
import type { LifeGoalProposeRequest } from '@/data/lifegoal/lifegoalApi'

// Re-exported so hook tests keep importing it from here.
export { API_BASE }

// Shared p-turo line macros (mezo-24j): the recipe and meal fixtures describe the SAME 200 g túró,
// so they share one contribution source — Σ lines equals the declared 580/42/78/12 rollup in both.
const P_TURO_CONTRIBUTION = { kcal: 320, p: 33, c: 36, f: 7 }

// Recipe fixture (mezo-lns) mirroring the RecipeResponse contract — one breakfast recipe with
// two pantry-item lines (computed name + contribution, lineOrder, nullable mezoFit.score).
const recipeFixture = {
  id: 'rc1f3a0e2-0000-4000-8000-000000000001',
  name: 'Túrós zabkása · áfonyával', slot: 'Reggeli', category: 'breakfast',
  servings: 1, prepMins: 5, cookMins: 3, tags: ['high-protein', 'pre-workout'], starred: true,
  // Same template as the mock seed's rec-1 → same role (mezo-uavr), so both modes agree.
  role: 'pre_workout',
  createdDate: 'Máj 14', novaDominant: 3, macros: { kcal: 580, p: 42, c: 78, f: 12 },
  mezoFit: { score: null, fitsFor: ['Reggel · Gyógyszer D3'] },
  timesLogged: 0, avgScore: 0, lastLogged: '—',
  ingredients: [
    { pantryItemId: 'p-zab', amount: 70, unit: 'g', note: null, lineOrder: 0, name: 'Zabpehely', contribution: { kcal: 260, p: 9, c: 42, f: 5 } },
    { pantryItemId: 'p-turo', amount: 200, unit: 'g', note: null, lineOrder: 1, name: 'Túró', contribution: P_TURO_CONTRIBUTION },
  ],
}

// Meal fixture (mezo-arb) mirroring MealResponse — one breakfast meal with two pantry-arm items
// (server snapshot name + contribution, lineOrder, pending null score).
const mealFixture = {
  id: 'me1f3a0e2-0000-4000-8000-000000000001',
  slot: 'breakfast', loggedAt: '2026-06-24T09:15:00', mealDate: '2026-06-24',
  title: 'Túrós zabkása · áfonyával',
  macros: { kcal: 580, p: 42, c: 78, f: 12 },
  score: { value: null, breakdown: null },
  items: [
    { source: 'pantry', recipeId: null, pantryItemId: 'p-zab', amount: 70, unit: 'g', lineOrder: 0, name: 'Zabpehely', nova: 1, contribution: { kcal: 260, p: 9, c: 42, f: 5 } },
    { source: 'pantry', recipeId: null, pantryItemId: 'p-turo', amount: 200, unit: 'g', lineOrder: 1, name: 'Túró', nova: 3, contribution: P_TURO_CONTRIBUTION },
  ],
}
const fuelDayFixture = {
  date: '2026-06-24',
  targets: { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 },
  consumed: { kcal: 580, p: 42, c: 78, f: 12, water: 4000 },
  meals: [mealFixture],
}
const recipeLogFixture = {
  recentLogs: [
    { mealId: 'me1f3a0e2-0000-4000-8000-000000000001', slot: 'breakfast', loggedAt: '2026-06-24T09:15:00', kcal: 580, p: 42, c: 78, f: 12, score: null },
  ],
}

// Recipe template-breakdown fixture (mezo-bw3y, 8-dim since mezo-7797) mirroring
// RecipeBreakdownResponse: the enriched envelope — the seven meal-shared dims plus a real `portion`
// card (which replaces the old weight-0 degraded context the template view used to keep).
const recipeBreakdownFixture = {
  breakdown: {
    value: 0.91,
    confidence: 0.86,
    summary: 'MSW sablon-olvasat.',
    dimensions: [
      { id: 'macro', label: 'Kcal & makró arány', weight: 0.22, score: 0.92, detail: 'MSW makró detail.',
        macro: { ratioP: 30, ratioC: 40, ratioF: 30, targetP: '~27%', targetC: '~46%', targetF: '~27%', kcalShareOfDay: 24.5, notes: null } },
      { id: 'micro', label: 'Rost & mikro', weight: 0.10, score: 0.88, detail: 'MSW mikró detail.',
        micros: [{ name: 'Rost', value: '9.5 g', pct: 82, status: 'good' }] },
      { id: 'who', label: 'Ajánlások · WHO', weight: 0.14, score: 0.9, detail: 'MSW WHO detail.',
        context: [{ label: 'Cukor', value: '6 E% / 10 E% limit' }, { label: 'Só', value: '0.8 g / 1.5 g keret' }] },
      { id: 'fat_quality', label: 'Zsírminőség', weight: 0.10, score: 0.85, detail: 'MSW zsír detail.',
        context: [{ label: 'Telített E%', value: '5% / 10% limit' }, { label: 'Telített/összzsír', value: '24% (ref. 33%)' }] },
      { id: 'nova', label: 'Feldolgozottság · NOVA', weight: 0.18, score: 0.94, detail: 'MSW nova detail.',
        nova: { dominant: 1, stack: [{ nova: 1, pct: 100, label: 'Zab' }], items: [{ name: 'Zabpehely 70g', nova: 1, warning: false }] } },
      { id: 'plant_diversity', label: 'Növényi diverzitás', weight: 0.08, score: 1.0, detail: 'MSW növényi detail.',
        context: [{ label: 'Növényi kategóriák', value: 'grains · fruits · nuts_seeds' }, { label: 'Összesen', value: '3 / 3 cél' }] },
      { id: 'energy_density', label: 'Energia-sűrűség', weight: 0.06, score: 0.78, detail: 'MSW sűrűség detail.',
        context: [{ label: 'Sűrűség', value: '182 kcal/100g' }, { label: 'Lefedettség', value: '100% gramm-alapú' }] },
      { id: 'portion', label: 'Adag-arány', weight: 0.12, score: 0.95, detail: 'Egy adag a reggeli büdzsé 89%-a.',
        context: [{ label: 'Adag kcal', value: '689 kcal' }, { label: 'Slot-büdzsé', value: '775 kcal (reggeli 25%)' }] },
    ],
    improve: [{ text: 'MSW javaslat.', impact: '+rost' }],
    tools: [
      { type: 'compute', name: 'templateFit(weights_renormalized)' },
      { type: 'compute', name: 'llm:sablon-olvasat' },
    ],
  },
  fitsFor: ['Post-workout · este'],
}

// Medication day fixture (mezo-lwmq): the owner tracks NO medication — the honest no-medication
// ghost. Tests that need the populated branch override this handler with `medicationFixture`.
const medicationDayFixture = {
  medication: {
    id: '', name: '', activeIngredient: '', route: '', cadence: '',
    defaultDose: 0, doseUnit: '', active: false,
    cycle: { cycleLengthDays: 0, phases: [] },
  },
  cycle: { cycleDay: 0, phaseKey: '', phaseLabel: '', lastDoseAt: null, week: [] },
  recentDoses: [],
}

// Proactive challenge (P7) wire factory — a minimal ChallengeResponse; tests override fields.
const challengeWire = (overrides: Record<string, unknown> = {}) => ({
  id: 'ch-1',
  exerciseId: 'ex-1',
  exercise: 'Chest Supported Row',
  type: 'PR',
  typeLabel: 'PR-attempt',
  status: 'proposed',
  target: '107.5 kg × 8',
  confidence: null,
  risk: 'low',
  why: 'Teszt indoklás.',
  glory: 'Új csúcs',
  refs: [{ kind: 'PR', label: 'Chest Row 105.8 · Márc 4' }],
  outcome: null,
  outcomeGood: null,
  generatedAt: '2026-07-07T06:45:00Z',
  ...overrides,
})

/** The one seeded run that HAS a frozen report (mezo-meyc.2) — every other id 404s. */
export const REPORT_MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000aa'

// Minimal MesocycleReportResponse: enough shape for the report page to render end-to-end
// (adherence + one strength row + one record), no volume arc (the contract allows null).
// aiEval/context are deliberately SHORT literals here (not imported from mesoReportMock,
// data/train/train.ts is a big module — pulling it into handlers.ts would tax every test
// file's setup, since nearly all of them import this file for MSW) but mirror its S3
// shape: a `ready` eval with a populated context (mezo-meyc.3).
const mesoReportFixture = {
  mesocycleId: REPORT_MESO_ID,
  templateId: null,
  title: 'Recovery rebuild · Tél',
  startDate: '2026-02-12',
  endDate: '2026-04-23',
  closedAt: '2026-04-23T19:40:00Z',
  weeks: 8,
  selfEval: 'Stabil blokk.',
  aiEval: 'Stabil, kontrollált blokk volt — jó alvással és fokozatos erő-progresszióval.\n\nA következő ciklusban érdemes a volument tovább emelni.',
  aiEvalStatus: 'ready',
  aiEvalGeneratedAt: '2026-04-23T19:45:00Z',
  aiEvalEnabled: true,
  adherence: {
    plannedSessions: 24, completedSessions: 21, plannedWeeks: 8, completedWeeks: 8, completionPct: 88,
  },
  volume: null,
  strength: [
    {
      exerciseName: 'Chest Supported Row', muscle: 'back-mid', firstWeek: 1, lastWeek: 8,
      firstTopKg: 72.5, firstTopReps: 8, lastTopKg: 85, lastTopReps: 8,
      firstE1rm: 91.83, lastE1rm: 107.67, deltaKg: 12.5, deltaPct: 17.2,
    },
  ],
  records: {
    medalCount: 3,
    top: [{ exerciseName: 'Chest Supported Row', kind: 'WEIGHT', date: '2026-04-09', value: 85 }],
  },
  context: {
    weeks: [
      { week: 1, sleepAvgH: 7.2, sleepQualityAvg: 7, kcalAvg: 2400, kcalTargetAvg: 2450, mealCoverageDays: 6, waterAvgMl: 2400, energyAvg: 6.5, stressAvg: 4.5, weightDeltaKg: -0.2, sportMinutes: 90, sportSessions: 2, runSessions: 1, gymRpeAvg: 7.0 },
      // A deliberate null hole — no sleep data this week — exercises the "–" cell.
      { week: 2, sleepAvgH: null, sleepQualityAvg: null, kcalAvg: 2420, kcalTargetAvg: 2450, mealCoverageDays: 7, waterAvgMl: 2500, energyAvg: 6.8, stressAvg: 4.2, weightDeltaKg: -0.1, sportMinutes: 100, sportSessions: 2, runSessions: null, gymRpeAvg: 7.1 },
    ],
    totals: {
      daysTotal: 14, sleepAvgH: 7.2, kcalAvg: 2410, energyAvg: 6.7, stressAvg: 4.4,
      weightChangeKg: -0.3, sportMinutes: 190, sportSessions: 4, runSessions: 1, mealCoverageDays: 13,
    },
  },
}

// Mezo-kalauz seen-store (mezo-gb1s.1) in-memory state — module-level so the GET/PUT/DELETE
// handlers below share it across a whole test file; `resetTutorialProgressState` is called from
// `src/test/setup.ts`'s afterEach so one test's PUT can't leak into the next.
let tutorialProgressState: Record<string, unknown> = {}
export function resetTutorialProgressState(): void {
  tutorialProgressState = {}
}

// ── Life-goal write helpers (mezo-iizd.1) ────────────────────────────────────────────────
// The five write endpoints all answer with a full LifeGoalResponse built off the seeded goal,
// so a real-mode test of a write path asserts against the SAME shape the backend echoes
// (LifeGoalService.create/update + LifeGoalPillarService.replace) instead of escaping to the
// network under setup.ts's `onUnhandledRequest: 'bypass'`.
const MSW_NOW = '2026-09-01T08:00:00Z'

/** Resolve a seeded goal by id — the handlers 404 on an unknown id, as the backend does. */
function findLifeGoal(id: string) {
  return MOCK_LIFE_GOALS.find((g) => g.id === id) ?? null
}

/** Fill in the server-assigned pillar ids/positions the backend stamps on every write. */
function lifeGoalEcho(g: Record<string, unknown>) {
  const pillars = (g.pillars as Record<string, unknown>[] | undefined) ?? []
  return {
    ...g,
    frame: g.frame ?? 'unset',
    ifThenPlans: g.ifThenPlans ?? [],
    pillars: pillars.map((p, i) => ({ ...p, id: (p.id as string) ?? `lg-p-${i}`, position: i, weight: p.weight ?? 1, active: p.active ?? true })),
  }
}

export const handlers = [
  http.post(`${API_BASE}/api/auth/login`, () => HttpResponse.json({ token: 'test-token' })),
  http.post(`${API_BASE}/api/auth/register`, () => HttpResponse.json({ token: 'test-token' })),
  http.get(`${API_BASE}/api/auth/me`, () =>
    HttpResponse.json({
      id: '00000000-0000-0000-0000-000000000001', email: 'owner@mezo.local', name: 'Owner',
      role: 'OWNER', onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest',
    }),
  ),
  http.post(`${API_BASE}/api/auth/change-password`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_BASE}/api/auth/onboarding-complete`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${API_BASE}/api/biometrics/weight`, () =>
    HttpResponse.json([{ id: 'w1', date: '2026-06-01', value: 82.5, note: null }]),
  ),

  // Biometric profile (G6, mezo-06n) — default complete profile + a derived
  // base-TDEE bootstrap. Tests that want the 404 "no profile" state override
  // with server.use(http.get(..., () => new HttpResponse(null, { status: 404 }))).
  http.get(`${API_BASE}/api/biometrics/profile`, () =>
    HttpResponse.json({
      sex: 'M',
      heightCm: 180,
      birthDate: '1991-03-01',
      bodyFatPct: 15,
      activityLevel: 'MIXED',
      tdeeBootstrap: { bmr: 1910, neat: 1.35, neatBaselineKcal: 2579, weeklyEatKcalPerDay: 421, tdee: 3000, formula: 'KATCH', computedAt: '2026-05-22T06:00:00Z' },
    }),
  ),
  // Progression profile (P6). Tests can override to ghost with a 404 (switch off).
  http.get(`${API_BASE}/api/progression/profile`, () =>
    HttpResponse.json({
      athleteLevel: 4.3,
      streakWeeks: 5,
      athletic: [],
      muscle: [],
      radarAxes: [
        { axis: 'Erő', value: 6.8 }, { axis: 'Robbanékonyság', value: 4.5 }, { axis: 'Sebesség', value: 3.0 },
        { axis: 'Állóképesség', value: 5.5 }, { axis: 'Mozgékonyság', value: 3.2 }, { axis: 'Koordináció', value: 4.0 },
      ],
      highlights: { bestAthletic: { skillKey: 'max_strength', level: 7 }, bestMuscle: { skillKey: 'back-mid', level: 6 } },
      life: [],
      traits: { disciplinePct: null, consistencyWeeks: 0 },
      savingsHuf30d: null,
    }),
  ),
  // LLM usage summary (mezo-h3gb) — day/week/month rollups over the audit log.
  // Honest zeros are a valid contract answer, so the default is a populated
  // triple; the null-cost case is exercised via server.use() in AiUsageCard's test.
  http.get(`${API_BASE}/api/llm-usage/summary`, () =>
    HttpResponse.json({
      day: { callCount: 9, costUsd: 0.03, currency: 'USD' },
      week: { callCount: 61, costUsd: 0.24, currency: 'USD' },
      month: { callCount: 240, costUsd: 0.95, currency: 'USD' },
    }),
  ),
  // Beta admin (mezo-qw37.3) — populated defaults mirroring the mock seed; tests override with
  // server.use() to capture payloads. The 403 USER path is a backend concern (AdminInviteIT).
  http.get(`${API_BASE}/api/admin/invites`, () => HttpResponse.json(ADMIN_INVITES_MOCK)),
  http.post(`${API_BASE}/api/admin/invites`, async ({ request }) => {
    const body = (await request.json()) as { label: string | null }
    return HttpResponse.json({ ...ADMIN_INVITES_MOCK[0], id: 'msw-invite', code: 'MEZO-MSWX-TEST', label: body.label })
  }),
  http.delete(`${API_BASE}/api/admin/invites/:id`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API_BASE}/api/admin/users`, () => HttpResponse.json(ADMIN_USERS_MOCK)),
  http.post(`${API_BASE}/api/admin/users/:id/reset-password`, () => HttpResponse.json({ temporaryPassword: 'MswTempPw2026' })),
  http.post(`${API_BASE}/api/admin/users/:id/status`, () => new HttpResponse(null, { status: 204 })),
  // Gamification profile (mezo-huzd) — populated default (never a 404 in the contract;
  // the backend answers ghost-shaped zeros before any activity, not an HTTP error).
  // Tests override with server.use() for specific field-mapping/mutation assertions.
  http.get(`${API_BASE}/api/gamification/profile`, () =>
    HttpResponse.json({
      totalXp: 860, level: 6, xpInLevel: 60, xpForNext: 240,
      coins: 45, streakDays: 4, streakAlive: true, streakSavers: 1,
      equippedTitleKey: 'kovetkezetes', ownedTitleKeys: [],
    })),
  // Gamification day (mezo-huzd, the Harvest read) — honest-zero default; never a 404.
  http.get(`${API_BASE}/api/gamification/day/:date`, ({ params }) =>
    HttpResponse.json({
      date: String(params.date), xpBySource: [], xpTotal: 0,
      coinEvents: [], coinTotal: 0, streakDays: 0, streakAlive: false,
    })),
  // Shop/streak-saver mutations — default happy-path echoes the profile default above
  // (unchanged); tests override with server.use() to capture payload/coins deltas.
  http.post(`${API_BASE}/api/gamification/title/:key/buy`, ({ params }) =>
    HttpResponse.json({
      totalXp: 860, level: 6, xpInLevel: 60, xpForNext: 240,
      coins: 45, streakDays: 4, streakAlive: true, streakSavers: 1,
      equippedTitleKey: String(params.key), ownedTitleKeys: [String(params.key)],
    })),
  http.post(`${API_BASE}/api/gamification/title/:key/equip`, ({ params }) =>
    HttpResponse.json({
      totalXp: 860, level: 6, xpInLevel: 60, xpForNext: 240,
      coins: 45, streakDays: 4, streakAlive: true, streakSavers: 1,
      equippedTitleKey: String(params.key), ownedTitleKeys: [],
    })),
  http.post(`${API_BASE}/api/gamification/saver/buy`, () =>
    HttpResponse.json({
      totalXp: 860, level: 6, xpInLevel: 60, xpForNext: 240,
      coins: 45, streakDays: 4, streakAlive: true, streakSavers: 2,
      equippedTitleKey: 'kovetkezetes', ownedTitleKeys: [],
    })),
  // Notification prefs (N2/N3, mezo-h4wp.6.2/.3) — default: all 11 categories, code defaults
  // (mirrors notificationPrefSeed). NotificationsPage's settings list + preview header need
  // this in real mode; tests override with server.use() for write/rollback assertions.
  http.get(`${API_BASE}/api/notification/pref`, () => HttpResponse.json({ prefs: notificationPrefSeed })),
  http.put(`${API_BASE}/api/notification/pref`, () => new HttpResponse(null, { status: 204 })),

  // Ritual day (R3, mezo-ilsj) — open window, not yet closed. Tests override with
  // server.use() for the closed-day / custom-window assertions.
  http.get(`${API_BASE}/api/ritual/day/:date`, ({ params }) =>
    HttpResponse.json({
      date: String(params.date), closed: false, closedAt: null,
      window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
    })),
  http.post(`${API_BASE}/api/ritual/close`, async ({ request }) => {
    const body = (await request.json()) as { date: string }
    return HttpResponse.json({
      date: body.date, closed: true, closedAt: '2026-07-25T20:24:00Z',
      window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
    })
  }),
  // Ritual reflection upsert (W1.2, mezo-b3pp.2) — a DEFAULT so real-mode COMPONENT tests that
  // save prose (ReflectionStep/RitualPage) never fall through to the network: `setupServer` has
  // no `onUnhandledRequest: 'error'`, so a missing handler would fail confusingly rather than
  // loudly. Echoes the backend's strip()-then-null-if-blank semantics; tests that assert the
  // exact payload override with server.use().
  http.put(`${API_BASE}/api/ritual/reflection`, async ({ request }) => {
    const body = (await request.json()) as { date: string; text: string }
    return HttpResponse.json({
      date: body.date, closed: false, closedAt: null,
      reflectionText: body.text.trim() || null,
      window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
    })
  }),

  http.put(`${API_BASE}/api/biometrics/profile`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...body, tdeeBootstrap: null })
  }),
  http.post(`${API_BASE}/api/biometrics/weight`, async ({ request }) => {
    const body = (await request.json()) as { date: string; weightKg: number; note?: string | null }
    return HttpResponse.json(
      { id: 'w2', date: body.date, value: body.weightKg, note: body.note ?? null },
      { status: 201 },
    )
  }),
  // G5 EWMA trend (mezo-g1u) — default happy-path; tests override with server.use().
  http.get(`${API_BASE}/api/biometrics/weight/trend`, () =>
    HttpResponse.json({
      ewmaSeries: [{ date: '2026-06-01', trendKg: 82.5 }],
      latestTrendKg: 82.5,
      weeklyRateKgPerWeek: -0.4,
      weeklyRatePctPerWeek: -0.48,
      last4wRateKgPerWeek: -0.6,
      dataSufficiency: 'full',
    }),
  ),

  http.get(`${API_BASE}/api/biometrics/sleep`, () =>
    HttpResponse.json([
      { id: 's1', date: '2026-05-30', bedtime: '23:10', wakeup: '06:40', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 0, notes: null },
      { id: 's2', date: '2026-05-31', bedtime: '23:20', wakeup: '06:50', duration: 7.4, quality: 8, awakenings: 1, mealToSleep: 0, notes: null,
        inBedMin: 470, awakeMin: 24, lightMin: 204, remMin: 140, deepMin: 100, sourceQualityPct: 85, source: 'screenshot' },
      { id: 's3', date: '2026-06-01', bedtime: '00:42', wakeup: '09:03', duration: 7.5, quality: 9, awakenings: 1, mealToSleep: 0, notes: null,
        inBedMin: 501, awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100, sourceQualityPct: 95, source: 'screenshot',
        hypnogram: { bucketMin: 15, stages: 'ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR' } },
    ]),
  ),
  http.post(`${API_BASE}/api/biometrics/sleep`, async ({ request }) => {
    const body = (await request.json()) as {
      date: string; bedtime: string; wakeup: string; durationH: number
      quality: number; awakenings: number; note?: string | null
      hypnogram?: { bucketMin: number; stages: string } | null
    }
    return HttpResponse.json(
      {
        id: 's2', date: body.date, bedtime: body.bedtime, wakeup: body.wakeup,
        duration: body.durationH, quality: body.quality, awakenings: body.awakenings,
        mealToSleep: 0, notes: body.note ?? null,
        hypnogram: body.hypnogram ?? null,
      },
      { status: 201 },
    )
  }),

  // Sleep goal (mezo-dbsr) — default demo goal tuned to the sleep-log cluster (bed 23:15 /
  // wake 06:45); never a 404 (the backend resolves the config ghost). PUT re-derives the
  // free end from the anchor. Tests override with server.use() for payload capture.
  http.get(`${API_BASE}/api/sleep/goal`, () =>
    HttpResponse.json({
      targetMinutes: 450, anchor: 'WAKE', anchorTime: '06:45',
      wakeTime: '06:45', bedTime: '23:15', regularityBandMin: 15,
    })),
  http.put(`${API_BASE}/api/sleep/goal`, async ({ request }) => {
    const body = (await request.json()) as { targetMinutes: number; anchor: 'WAKE' | 'BED'; anchorTime: string; regularityBandMin?: number }
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
    const toHHmm = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 1440) + 1440) % 1440 % 60).padStart(2, '0')}`
    const wakeTime = body.anchor === 'WAKE' ? body.anchorTime : toHHmm(toMin(body.anchorTime) + body.targetMinutes)
    const bedTime = body.anchor === 'BED' ? body.anchorTime : toHHmm(toMin(body.anchorTime) - body.targetMinutes)
    return HttpResponse.json({ ...body, regularityBandMin: body.regularityBandMin ?? 15, wakeTime, bedTime })
  }),

  http.get(`${API_BASE}/api/biometrics/checkin`, () => HttpResponse.json([])),

  // Unified companion-message feed (companion-feed, mezo-gst9) — default: honest empty array
  // (never a 404 — a list endpoint, the P1 precedent). Tests override with server.use(...).
  http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json([])),

  // Proactive weekly suggestion (W1) — default: honest 404, the Weekly card keeps its placeholder.
  http.get(`${API_BASE}/api/proactive/weekly-suggestion`, () => new HttpResponse(null, { status: 404 })),

  // Proactive memoir (W2) — default: honest 404, MemoirPage renders its "készül" state.
  http.get(`${API_BASE}/api/proactive/memoir`, () => new HttpResponse(null, { status: 404 })),
  // F7.5: the archive shelf — default honest empty list (list-endpoint precedent).
  http.get(`${API_BASE}/api/proactive/memoir/archive`, () => HttpResponse.json({ entries: [] })),

  // Proactive prediction (P1) — default: honest empty ARRAY (list endpoint, never 404); the
  // PredictionsPage renders its "still learning" null-state.
  http.get(`${API_BASE}/api/proactive/prediction`, () => HttpResponse.json([])),

  // Proactive experiment (P2) — default: honest empty ARRAY (list endpoint, never 404); the
  // ExperimentsPage renders its "still learning" null-state. Tests override with server.use(...).
  // Diagnosis (mezo-hqfi.4): honest-empty list; generate answers 409 by default (a fresh test
  // user has thin data) — per-test overrides script the happy/quota paths.
  http.get(`${API_BASE}/api/proactive/diagnosis`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/proactive/diagnosis`, () =>
    HttpResponse.json([{ code: 'DIAGNOSIS_INSUFFICIENT_DATA', message: 'nincs elég adat' }], { status: 409 })),
  http.get(`${API_BASE}/api/proactive/diagnosis/:id`, () =>
    HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND', message: 'nincs ilyen' }], { status: 404 })),
  http.post(`${API_BASE}/api/proactive/diagnosis/:id/suspect/:rank/experiment`, ({ params }) =>
    HttpResponse.json({
      id: 'exp-from-diag', title: 'Próba', hypothesis: 'Próba-hipotézis.', status: 'active',
      metricKey: 'SLEEP_DURATION_H', expectedDirection: 'up', startDate: '2026-08-31',
      totalDays: 7, outcome: null, outcomeGood: null, generatedAt: '2026-08-31T07:00:00Z',
      rank: Number(params.rank),
    }, { status: 201 })),
  http.get(`${API_BASE}/api/proactive/experiment`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/proactive/experiment/propose`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/proactive/experiment/:id/decision`, async ({ params, request }) => {
    const body = (await request.json()) as { decision: 'accept' | 'dismiss' }
    return HttpResponse.json({
      id: params.id,
      title: 'Teszt kísérlet',
      hypothesis: 'Teszt hipotézis.',
      status: body.decision === 'accept' ? 'active' : 'dismissed',
      metricKey: 'sleep_avg',
      expectedDirection: 'up',
      startDate: body.decision === 'accept' ? '2026-07-07' : null,
      totalDays: 7,
      outcome: null,
      outcomeGood: null,
      generatedAt: '2026-07-07T06:45:00Z',
    })
  }),

  // Proactive challenge (P7) — default: honest empty ARRAY (list endpoint, never 404); the
  // ActiveWorkout surface renders its empty state. Tests override with server.use(...).
  http.get(`${API_BASE}/api/proactive/challenge`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/proactive/challenge/:id/decision`, async ({ params, request }) => {
    const { decision } = (await request.json()) as { decision: 'accept' | 'dismiss' }
    return HttpResponse.json(
      challengeWire({ id: params.id, status: decision === 'accept' ? 'accepted' : 'dismissed' }),
    )
  }),

  // Daily quests (gamified growth E1) — default: honest empty day. Tests override with server.use(...).
  http.get(`${API_BASE}/api/quest/day/:date`, ({ params }) =>
    HttpResponse.json({ date: params.date, quests: [], levelUps: [], rerollsLeft: 1 }),
  ),
  http.post(`${API_BASE}/api/quest/:id/reroll`, ({ params }) =>
    HttpResponse.json({
      id: `${params.id}-r`, questDate: '2026-07-11', slot: 'FUELBIO', skillKey: 'recovery',
      title: 'Csere-küldetés', why: 'Teszt.', targetLabel: '', metric: 'weight_logged', xp: 15,
      status: 'offered', completionMode: 'DERIVED', completedAt: null,
    }),
  ),

  // Habit engine (mezo-d1jb) — honest-empty defaults (day: empty chains, summary: zeros; never a
  // 404). Tests override with server.use() for populated cases.
  http.get(`${API_BASE}/api/habit/day/:date`, ({ params }) =>
    HttpResponse.json({ date: params.date, habits: [], levelUps: [] }),
  ),
  http.get(`${API_BASE}/api/habit/summary`, () =>
    HttpResponse.json({ perfectMorningDays30: 0, perfectEveningDays30: 0, habits: [] }),
  ),

  // Habit admin catalog (routine editor, mezo-n5e9.2) — honest-empty default (never a 404);
  // write endpoints echo a minimal valid HabitChainAdmin/HabitDefAdmin so the mutation hooks'
  // wire→domain mapping has something real to map. Tests override with server.use() for
  // populated/payload-capture cases.
  http.get(`${API_BASE}/api/habit/catalog`, () => HttpResponse.json({ chains: [] })),
  http.post(`${API_BASE}/api/habit/chain`, async ({ request }) => {
    const body = (await request.json()) as { title: string; daypart: string }
    return HttpResponse.json({
      id: 'chain-new', chainKey: 'chain_00000001', title: body.title, daypart: body.daypart,
      position: 1, isActive: true, defs: [],
    })
  }),
  http.patch(`${API_BASE}/api/habit/chain/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: String(params.id), chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
      position: 1, isActive: true, defs: [], ...body,
    })
  }),
  http.delete(`${API_BASE}/api/habit/chain/:id`, () => new HttpResponse(null, { status: 204 })),
  http.put(`${API_BASE}/api/habit/chain/:id/order`, ({ params }) =>
    HttpResponse.json({
      id: String(params.id), chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
      position: 1, isActive: true, defs: [],
    })),
  http.post(`${API_BASE}/api/habit/def`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: 'def-new', habitKey: 'custom_00000001', chainKey: String(body.chainKey ?? 'MORNING'),
      position: 1, title: String(body.title ?? ''), why: null, anchorCopy: null,
      mode: body.mode ?? 'MANUAL', metric: 'manual', skillKey: String(body.skillKey ?? 'mindset'),
      xp: Number(body.xp ?? 0), linkUrl: null, isActive: true,
    })
  }),
  http.patch(`${API_BASE}/api/habit/def/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: String(params.id), habitKey: 'custom_00000001', chainKey: 'MORNING', position: 1,
      title: 'Def', why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindset',
      xp: 5, linkUrl: null, isActive: true, ...body,
    })
  }),
  http.delete(`${API_BASE}/api/habit/def/:id`, () => new HttpResponse(null, { status: 204 })),
  // AI habit suggestion (mezo-n5e9.3) — honest-empty default (never a 404/503); tests override
  // with server.use() for the populated-cards and unavailable (503/404) cases.
  http.post(`${API_BASE}/api/habit/ai/suggest`, () => HttpResponse.json({ suggestions: [] })),

  // Daily intention (mezo-a686) — honest-empty default (no creed, no foci, no reflection; never a
  // 404). Tests override with server.use() for populated cases.
  http.get(`${API_BASE}/api/intention/day/:date`, ({ params }) =>
    HttpResponse.json({ date: params.date, creed: null, foci: [], reflection: null, focusCap: 3 }),
  ),

  // Growth history + achievements (Growth page, mezo-rmhr) — honest-empty defaults
  // (never a 404); tests override with server.use() for data cases.
  http.get(`${API_BASE}/api/quest/history`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/activity/history`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/progression/achievements`, () =>
    HttpResponse.json({
      badges: [
        { key: 'first_quest', icon: '🏁', name: 'Első küldetés', achieved: false, current: 0, target: 1 },
      ],
      perks: [],
    })),
  // Growth week rollup (mezo-rmi0.1) — honest zeros are a valid contract answer.
  http.get(`${API_BASE}/api/progression/growth-week/:date`, ({ params }) =>
    HttpResponse.json({ weekStart: params.date, questCompleted: 0, questClosed: 0, lifeXp: 0, activities: 0, savingsHuf: 0 }),
  ),

  // ── Activity log (E2, mezo-jzca). Defaults: empty day; create echoes a confident AI verdict.
  http.get(`${API_BASE}/api/activity/day/:date`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/activity`, async ({ request }) => {
    const body = (await request.json()) as { text: string; occurredOn?: string }
    return HttpResponse.json({
      entry: {
        id: 'act-new',
        occurredOn: body.occurredOn ?? '2026-07-11',
        text: body.text,
        skillKey: 'learning',
        confidence: 0.9,
        xpAwarded: 15,
        durationMin: null,
        amountHuf: null,
        categorizedBy: 'AI',
        createdAt: '2026-07-11T12:00:00Z',
      },
      completedQuest: null,
      levelUps: [],
    })
  }),
  http.post(`${API_BASE}/api/activity/:id/category`, async ({ params, request }) => {
    const body = (await request.json()) as { skillKey: string }
    return HttpResponse.json({
      entry: {
        id: params.id,
        occurredOn: '2026-07-11',
        text: 'Besorolt bejegyzés',
        skillKey: body.skillKey,
        confidence: 0.4,
        xpAwarded: 10,
        durationMin: null,
        amountHuf: null,
        categorizedBy: 'USER',
        createdAt: '2026-07-11T12:00:00Z',
      },
      completedQuest: null,
      levelUps: [],
    })
  }),

  // People (Slice E) — empty bootstrap default; tests override with server.use for data cases.
  http.get(`${API_BASE}/api/people`, () => HttpResponse.json({ persons: [], mentions: [], mezoNote: '' })),
  http.post(`${API_BASE}/api/people`, async ({ request }) => {
    const req = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: crypto.randomUUID(),
      name: req.name,
      initial: (req.name as string)[0],
      relationship: req.relationship,
      relationshipHu: req.relationshipHu,
      aliases: req.aliases ?? [],
      status: 'active',
      sourceKind: 'manual',
      affectBaseline: req.affectBaseline,
      contactCadenceLabel: req.contactCadenceLabel,
      notes: req.notes,
      mentionCount: 0,
      mentionsThisWeek: 0,
      knownFacts: [],
      ties: [],
      affectTrend: [],
      direction: 'flat',
    }, { status: 201 })
  }),
  http.put(`${API_BASE}/api/people/:id`, async ({ params, request }) => {
    const req = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: params.id,
      name: req.name,
      initial: (req.name as string)[0],
      relationship: req.relationship,
      relationshipHu: req.relationshipHu,
      aliases: req.aliases ?? [],
      status: 'active',
      sourceKind: 'manual',
      affectBaseline: req.affectBaseline,
      contactCadenceLabel: req.contactCadenceLabel,
      notes: req.notes,
      mentionCount: 0,
      mentionsThisWeek: 0,
      knownFacts: [],
      ties: [],
      affectTrend: [],
      direction: 'flat',
    })
  }),
  http.delete(`${API_BASE}/api/people/:id`, () => new HttpResponse(null, { status: 204 })),
  http.delete(`${API_BASE}/api/people/:personId/mentions/:mentionId`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_BASE}/api/people/:personId/decision`, async ({ params, request }) => {
    const body = await request.json() as { decision: string }
    return HttpResponse.json({
      id: params.personId, name: 'Marci', initial: 'M', relationship: 'friend',
      relationshipHu: 'Ismerős', aliases: [], status: body.decision === 'accept' ? 'active' : 'candidate',
      sourceKind: 'extractor', affectBaseline: 'neutral', knownFacts: [], ties: [], affectTrend: [],
      direction: 'flat', mentionCount: 0, mentionsThisWeek: 0,
    })
  }),

  http.post(`${API_BASE}/api/biometrics/checkin`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: 'c1', ...body, savedAt: '2026-06-01T09:00:00Z' }, { status: 200 })
  }),

  // Train — small fixtures mirroring the demodata seed (one active meso with a
  // chest volume profile + one day; two sport sessions). Backend serves ISO
  // dates; the hook formats them to HU display strings.
  http.get(`${API_BASE}/api/train/mesocycles`, () =>
    HttpResponse.json([
      {
        id: 'b6f3a0e2-0000-4000-8000-000000000001',
        title: 'Hypertrophy 04 · Tavasz',
        shortTitle: 'Hypertrophy 04',
        status: 'active',
        goal: 'Felsőtest hypertrophy · izomtömeg építés',
        startDate: '2026-05-01',
        endDate: '2026-06-12',
        weeks: 6,
        currentWeek: 3,
        split: 'Pull / Push / Legs · 5×/hét',
        style: 'RP · 6 hét',
        phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
        musclePriorities: { back: 'emphasize' },
        volumePerMuscle: {
          chest: {
            mev: 8, mav: 14, mrv: 20, current: 14,
            source: {
              baseline: { name: 'RP guidelines · intermediate', mev: 8, mav: 12, mrv: 18 },
              adjustments: [{ kind: 'pattern', label: 'Q1 retro stabil', delta: { mrv: 2 } }],
              confidence: 0.78,
            },
          },
        },
        days: [
          {
            id: 'a1f3a0e2-0000-4000-8000-000000000010',
            day: 'Csü', type: 'Pull', muscle: 'back+bicep', exerciseCount: 1, current: true,
            exercises: [
              {
                id: 'c1f3a0e2-0000-4000-8000-000000000002', name: 'Chest Supported Row',
                muscle: 'back-mid', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound',
              },
            ],
          },
        ],
      },
    ]),
  ),
  http.get(`${API_BASE}/api/train/sport-sessions`, () =>
    HttpResponse.json([
      {
        id: 'd1f3a0e2-0000-4000-8000-000000000003', sport: 'volleyball', date: '2026-05-20',
        time: '18:00', duration: 90, setsPlayed: 5, intensity: 7, rpe: 6.8, shoulderStrain: 6, jumpCount: 38,
      },
      {
        id: 'd1f3a0e2-0000-4000-8000-000000000004', sport: 'volleyball', date: '2026-05-18',
        time: '10:00', duration: 120, setsPlayed: 6, intensity: 8, rpe: 7.2, shoulderStrain: 7, jumpCount: 52,
        notes: 'Hosszú meccs · maradt erő utána',
      },
    ]),
  ),
  // T1 write endpoints — minimal happy-path defaults; tests override with spies when
  // they need to capture the payload.
  http.post(`${API_BASE}/api/train/mesocycles/:id/rerun`, ({ params }) =>
    HttpResponse.json({ templateId: String(params.id) }),
  ),
  // Meso templates (mezo-meyc): the wizard now saves a template, then starts a run from it.
  // GET/POST list+create, PUT/DELETE by id, POST .../start returns a MesocycleResponse.
  http.get(`${API_BASE}/api/train/meso-templates`, () =>
    HttpResponse.json([
      {
        id: 'a10e0000-0000-4000-8000-000000000000',
        title: 'Hypertrophy 04 · Tavasz',
        shortTitle: 'Hypertrophy 04',
        goal: 'Felsőtest hypertrophy · izomtömeg építés',
        weeks: 6,
        split: 'Pull / Push / Legs · 5×/hét',
        style: 'RP · 6 hét',
        phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
        runCount: 1,
        days: [
          {
            day: 'Csü', type: 'Pull', muscle: 'back+bicep', exerciseCount: 1,
            exercises: [
              {
                id: 'c1f3a0e2-0000-4000-8000-000000000002', name: 'Chest Supported Row',
                muscle: 'back-mid', warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound',
              },
            ],
          },
          { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] },
        ],
      },
    ]),
  ),
  http.post(`${API_BASE}/api/train/meso-templates`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      {
        id: 'e1f3a0e2-0000-4000-8000-000000000001',
        title: String(body.title ?? ''),
        shortTitle: body.shortTitle ?? null,
        goal: body.goal ?? null,
        goalPreset: body.goalPreset ?? null,
        musclePriorities: body.musclePriorities ?? null,
        weeks: Number(body.weeks ?? 0),
        split: body.split ?? null,
        style: body.style ?? null,
        phaseCurve: body.phaseCurve ?? [],
        notes: body.notes ?? null,
        days: body.days ?? [],
        runCount: 0,
      },
      { status: 201 },
    )
  }),
  http.put(`${API_BASE}/api/train/meso-templates/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: String(params.id),
      title: String(body.title ?? ''),
      shortTitle: body.shortTitle ?? null,
      goal: body.goal ?? null,
      goalPreset: body.goalPreset ?? null,
      musclePriorities: body.musclePriorities ?? null,
      weeks: Number(body.weeks ?? 0),
      split: body.split ?? null,
      style: body.style ?? null,
      phaseCurve: body.phaseCurve ?? [],
      notes: body.notes ?? null,
      days: body.days ?? [],
      runCount: 1,
    })
  }),
  http.delete(`${API_BASE}/api/train/meso-templates/:id`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_BASE}/api/train/meso-templates/:id/start`, async ({ params, request }) => {
    const body = (await request.json()) as { startDate: string; status: 'active' | 'planned' }
    return HttpResponse.json({
      id: 'f1f3a0e2-0000-4000-8000-000000000001',
      templateId: String(params.id),
      title: 'Hypertrophy 04 · Tavasz',
      shortTitle: 'Hypertrophy 04',
      status: body.status,
      // The run-side mock surface was left thin by mezo-dq60 — goalPreset/musclePriorities
      // are static here (this handler doesn't look up the started template's own values) so
      // real-mode stamp-carry tests can assert on them; tests needing a specific stamped
      // value override this handler with server.use.
      goalPreset: null,
      musclePriorities: null,
      startDate: body.startDate,
      endDate: body.startDate,
      weeks: 6,
      currentWeek: body.status === 'active' ? 1 : 0,
      split: 'Pull / Push / Legs · 5×/hét',
      style: 'RP · 6 hét',
      phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
    })
  }),
  // Meso plan generator (wizard redesign): deterministic default so real-mode wizard tests
  // can render a 7-day proposal without scripting; tests override per case with server.use.
  http.post(`${API_BASE}/api/train/meso-plans/generate`, async ({ request }) => {
    const body = (await request.json()) as { daysOfWeek: string[]; weeks: number; priorities?: Record<string, string> | null; goalText?: string | null }
    const training = new Set(body.daysOfWeek)
    const days = ['Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'].map((day, i) => training.has(day)
      ? { day, type: i % 2 === 0 ? 'Upper' : 'Lower', muscle: i % 2 === 0 ? 'back' : 'quad', exercises: [
          { name: i % 2 === 0 ? 'Row' : 'Squat', muscle: i % 2 === 0 ? 'back-mid' : 'quad', warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound', catalogId: 'c1f3a0e2-0000-4000-8000-000000000002' } ] }
      : { day, type: 'Rest', muscle: '', note: 'Pihenőnap', exercises: [] })
    return HttpResponse.json({
      template: { title: 'Hypertrophy · Ősz', shortTitle: 'Hypertrophy', goal: 'Izomtömeg építés', goalPreset: 'hypertrophy',
        musclePriorities: body.priorities ?? null, weeks: body.weeks, split: `Upper / Lower · ${body.daysOfWeek.length}×/hét`, style: `RP · ${body.weeks} hét`,
        phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'], notes: body.goalText ?? null, volumePerMuscle: null, days },
      rationale: 'MSW alap kiosztás', llmUsed: false,
    })
  }),
  http.post(`${API_BASE}/api/train/mesocycles/:id/activate`, ({ params }) =>
    HttpResponse.json({ id: params.id }),
  ),
  // Muscle-priorities replace (mezo-3m5m): echoes the body onto the mock run shape — tests
  // that need the FULL assembled response override with server.use.
  http.put(`${API_BASE}/api/train/mesocycles/:id/muscle-priorities`, async ({ params, request }) => {
    const body = (await request.json()) as { musclePriorities?: Record<string, string> | null }
    return HttpResponse.json({ id: params.id, musclePriorities: body.musclePriorities ?? null })
  }),
  // Close accepts an OPTIONAL `{ selfEval }` body (mezo-meyc.2) — read and ignore it here so
  // the default stays a happy path; tests that assert the payload override with a spy.
  http.post(`${API_BASE}/api/train/mesocycles/:id/close`, async ({ params, request }) => {
    await request.text()
    return HttpResponse.json({ id: params.id, status: 'archived', hasReport: true })
  }),
  // Run report (mezo-meyc.2). Exactly one seeded run has one; every other id answers the
  // contract's 404 so the FE's notFound → „Riport generálása" path is the default.
  http.get(`${API_BASE}/api/train/mesocycles/:id/report`, ({ params }) =>
    String(params.id) === REPORT_MESO_ID
      ? HttpResponse.json(mesoReportFixture)
      : HttpResponse.json(
          [{ code: 'TRAIN_MESO_REPORT_NOT_FOUND', message: 'Ehhez a futamhoz még nincs riport.' }],
          { status: 404 },
        ),
  ),
  http.post(`${API_BASE}/api/train/mesocycles/:id/report/regenerate`, () =>
    new HttpResponse(null, { status: 202 }),
  ),
  http.put(`${API_BASE}/api/train/mesocycles/:id/days/:dayId/exercises`, () =>
    HttpResponse.json({ day: 'Hét', type: 'Pull', muscle: '', exerciseCount: 0, exercises: [] }),
  ),
  // T2 workout-execution endpoints — happy-path defaults; tests override with spies.
  http.get(`${API_BASE}/api/train/workouts/today`, () =>
    HttpResponse.json({
      templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
      dayLabel: 'Csü',
      title: 'Pull Day',
      durationEst: 78,
      // Prescribed-sets contract shape (recipe + engine targets) — mirrors the mock
      // `workout` fixture so real-mode renders real prescribed data, not NaN/undefined.
      exercises: [
        {
          id: 'c1f3a0e2-0000-4000-8000-000000000002', name: 'Chest Supported Row',
          muscle: 'back-mid', type: 'compound',
          warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null,
          rationale: 'Múlt hét 9 × 102.5 kg → +2.5 kg',
          prescribedSets: [
            { kind: 'warmup', targetWeightKg: 52.5, targetReps: 10, targetRIR: null },
            { kind: 'warmup', targetWeightKg: 77.5, targetReps: 5, targetRIR: null },
            { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
            { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
            { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
          ],
          lastWeek: { weightKg: 102.5, reps: 9, rir: 2 },
          imageStartUrl: '/exercises/lat-pulldown-pronated-a.jpg',
          imageEndUrl: '/exercises/lat-pulldown-pronated-b.jpg',
        },
      ],
      openWorkout: null,
    }),
  ),
  http.get(`${API_BASE}/api/train/workouts`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/train/workouts`, () =>
    HttpResponse.json(
      {
        id: 'e1f3a0e2-0000-4000-8000-000000000020',
        templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
        date: '2026-06-12', status: 'active', sets: [],
      },
      { status: 201 },
    ),
  ),
  http.post(`${API_BASE}/api/train/workouts/:id/sets`, () =>
    HttpResponse.json(
      {
        id: 'f1f3a0e2-0000-4000-8000-000000000030', exerciseId: 'c1f3a0e2-0000-4000-8000-000000000002', setIndex: 0,
        // Empty, not omitted (mezo-wp6n): a bare `undefined` would let a real-mode medal
        // assertion silently pass against `r?.medals` — tests that need a populated
        // response override this handler with server.use().
        medals: [],
      },
      { status: 201 },
    ),
  ),
  http.post(`${API_BASE}/api/train/workouts/:id/feedback`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_BASE}/api/train/workouts/:id/finish`, ({ params }) =>
    HttpResponse.json({
      id: String(params.id),
      templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
      date: '2026-06-12', status: 'completed', sets: [],
      medals: [],
    }),
  ),
  // T3 sport endpoints — schedule fixture mirrors the demofixtures BVSC week.
  http.get(`${API_BASE}/api/train/sport-schedule`, () =>
    HttpResponse.json([
      { id: 'e1f3a0e2-0000-4000-8000-000000000050', dayOfWeek: 0, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
      { id: 'e1f3a0e2-0000-4000-8000-000000000051', dayOfWeek: 1, time: '17:00', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
      { id: 'e1f3a0e2-0000-4000-8000-000000000052', dayOfWeek: 2, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
      { id: 'e1f3a0e2-0000-4000-8000-000000000054', dayOfWeek: 4, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
      { id: 'e1f3a0e2-0000-4000-8000-000000000055', dayOfWeek: 5, time: '10:00', durationMin: 120, kind: 'match', location: 'Kőbánya Sport', intensityLabel: 'magas' },
    ]),
  ),
  // One-off sport events (mezo-e1sp) — default empty; tests override when they need one.
  http.get(`${API_BASE}/api/train/sport-events`, () => HttpResponse.json([])),
  // Weekly gym slots fixture — Csü (index 3) carries a time so deriveGymSchedule
  // can fill the meso fixture's only gym day. Lean shape: id + dayOfWeek + time.
  http.get(`${API_BASE}/api/train/gym-schedule`, () =>
    HttpResponse.json([
      { id: 'e2f3a0e2-0000-4000-8000-000000000060', dayOfWeek: 3, time: '18:30' },
    ]),
  ),
  // Exercise catalog fixture — small slice across muscles incl. one plyo item.
  // Hip Thrust must stay: the real-mode MesoExercises test picks it from the sheet.
  http.get(`${API_BASE}/api/train/exercises`, () =>
    HttpResponse.json([
      { id: 'f1e3a0e2-0000-4000-8000-000000000070', slug: 'chest-supported-row', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound', stim: 0.92, fatigue: 0.55, editable: true, videoUrl: 'https://youtu.be/GZTvxN5fPBc' },
      // Hip Thrust also carries the demo stills (mezo-8xdl) — 124 of the 161 master rows do.
      { id: 'f1e3a0e2-0000-4000-8000-000000000071', slug: 'hip-thrust', name: 'Hip Thrust', muscle: 'glute', type: 'compound', stim: 0.86, fatigue: 0.55, videoUrl: 'https://youtu.be/xDmFkJxPzeM', imageStartUrl: '/exercises/hip-thrust-a.jpg', imageEndUrl: '/exercises/hip-thrust-b.jpg' },
      { id: 'f1e3a0e2-0000-4000-8000-000000000072', slug: 'box-jump', name: 'Box Jump', muscle: 'quad', type: 'plyo', stim: 0.6, fatigue: 0.35 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000073', slug: 'lateral-raise', name: 'Lateral Raise', muscle: 'shoulder-side', type: 'isolation', stim: 0.72, fatigue: 0.2 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000074', slug: 'standing-calf-raise', name: 'Standing Calf Raise', muscle: 'calf', type: 'isolation', stim: 0.72, fatigue: 0.2 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000075', slug: 'cable-crunch', name: 'Cable Crunch', muscle: 'core', type: 'isolation', stim: 0.72, fatigue: 0.2 },
    ]),
  ),
  // Writable catalog mutations — author (POST), edit (PUT), delete, set video.
  http.post(`${API_BASE}/api/train/exercises`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { id: 'f1e3a0e2-0000-4000-8000-0000000000ff', slug: 'authored', editable: true, ...body },
      { status: 201 },
    )
  }),
  http.put(`${API_BASE}/api/train/exercises/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: params.id, slug: 'authored', editable: true, ...body })
  }),
  http.delete(`${API_BASE}/api/train/exercises/:id`, () => new HttpResponse(null, { status: 204 })),
  http.put(`${API_BASE}/api/train/exercises/:id/video`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: params.id, slug: 'authored', editable: true, ...body })
  }),
  // Exercise records fixture — one full weighted record + one bodyweight (plyo) record.
  http.get(`${API_BASE}/api/train/exercise-records`, () =>
    HttpResponse.json([
      {
        catalogId: 'f1e3a0e2-0000-4000-8000-000000000070',
        name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound',
        bestSet: { weightKg: 102.5, reps: 9, date: '2026-06-02' },
        bestE1rm: { value: 133.3, set: { weightKg: 102.5, reps: 9, date: '2026-06-02' } },
        bestSessionVolume: { volumeKg: 4920, date: '2026-05-26' },
        totalVolume: 182450, totalSets: 342, totalReps: 2814, sessionCount: 21,
        repRecords: [
          { weightKg: 102.5, reps: 9, date: '2026-06-02' },
          { weightKg: 100, reps: 9, date: '2026-05-19' },
          { weightKg: 90, reps: 13, date: '2026-04-28' },
        ],
        recentTopSets: [
          { weightKg: 95, reps: 8, date: '2026-05-12' },
          { weightKg: 100, reps: 9, date: '2026-05-19' },
          { weightKg: 100, reps: 8, date: '2026-05-23' },
          { weightKg: 102.5, reps: 8, date: '2026-05-26' },
          { weightKg: 102.5, reps: 9, date: '2026-06-02' },
        ],
      },
      {
        catalogId: 'f1e3a0e2-0000-4000-8000-000000000072',
        name: 'Box Jump', muscle: 'quad', type: 'plyo',
        totalVolume: 0, totalSets: 18, totalReps: 186, sessionCount: 6,
        repRecords: [],
        recentTopSets: [
          { reps: 10, date: '2026-05-26' },
          { reps: 12, date: '2026-06-02' },
        ],
      },
      // Name-grouped record (mezo-u5gk): NO catalogId (live backend returns none for
      // records whose logged exercise row lacks the catalog link), but the name
      // matches the Hip Thrust catalog row above — the card must resolve the
      // catalog item (video affordance) via the name fallback.
      {
        name: 'Hip Thrust', muscle: 'glute', type: 'compound',
        bestSet: { weightKg: 120, reps: 10, date: '2026-06-01' },
        bestE1rm: { value: 160, set: { weightKg: 120, reps: 10, date: '2026-06-01' } },
        totalVolume: 8400, totalSets: 12, totalReps: 118, sessionCount: 4,
        repRecords: [{ weightKg: 120, reps: 10, date: '2026-06-01' }],
        recentTopSets: [{ weightKg: 120, reps: 10, date: '2026-06-01' }],
      },
      // Live-backend bodyweight shape (mezo-kaui): sets logged with weight 0 come
      // back as bestSet.weightKg 0 + bestE1rm 0 (NOT absent, unlike Box Jump above)
      // — the card must still render the rep-based bodyweight stat branch.
      {
        catalogId: 'f1e3a0e2-0000-4000-8000-000000000076',
        name: 'Dead Hang', muscle: 'back-wide', type: 'plyo',
        bestSet: { weightKg: 0, reps: 35, date: '2026-06-02' },
        bestE1rm: { value: 0, set: { weightKg: 0, reps: 35, date: '2026-06-02' } },
        totalVolume: 0, totalSets: 2, totalReps: 65, sessionCount: 1,
        repRecords: [{ weightKg: 0, reps: 35, date: '2026-06-02' }],
        recentTopSets: [{ weightKg: 0, reps: 35, date: '2026-06-02' }],
      },
    ]),
  ),
  // Medal cabinet fixture (mezo-wp6n) — a small mixed-type slice; tests needing a
  // specific set/tier override with server.use().
  http.get(`${API_BASE}/api/train/medals`, () =>
    HttpResponse.json({
      medals: [
        {
          type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Chest Supported Row',
          catalogId: 'f1e3a0e2-0000-4000-8000-000000000070', muscle: 'back-mid', date: '2026-06-02',
          workoutSessionId: 'e1f3a0e2-0000-4000-8000-000000000020', setIndex: 2,
          value: 102.5, unit: 'KG', weightKg: 102.5, reps: 9,
          previousValue: 100, previousDate: '2026-05-19',
        },
        {
          type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Hip Thrust',
          catalogId: 'f1e3a0e2-0000-4000-8000-000000000071', muscle: 'glute', date: '2026-06-01',
          workoutSessionId: 'e1f3a0e2-0000-4000-8000-000000000021', setIndex: 1,
          value: 10, unit: 'REPS', weightKg: 120, reps: 10,
          previousValue: null, previousDate: null,
        },
        // SESSION_VOLUME carries the session's top set in weightKg/reps — exactly as
        // the real backend's MedalService.toMedal does (mezo-wp6n Finding 1) — so this
        // fixture actually exercises medalValueLabel's SESSION_VOLUME branch instead of
        // accidentally passing by omitting the fields. Numbers mirror MedalApiIT's
        // pinned scenario (820kg session volume off a 102.5×8 top set, beating 800kg).
        {
          type: 'SESSION_VOLUME', tier: 'RECORD', exerciseName: 'Leg Press',
          catalogId: 'f1e3a0e2-0000-4000-8000-000000000077', muscle: 'quad', date: '2026-06-05',
          workoutSessionId: 'e1f3a0e2-0000-4000-8000-000000000022', setIndex: 2,
          value: 820, unit: 'KG', weightKg: 102.5, reps: 8,
          previousValue: 800, previousDate: '2026-05-22',
        },
      ],
    }),
  ),
  // Timing profile default (Task 12, mezo-dzbm) — the static config seeds, all `samples: 0`,
  // matching `timingProfileMock` (train.ts) so mock and unmocked-real-mode tests agree.
  // Every field is ALWAYS present on this endpoint (no cold-start branch); tests exercising a
  // specific calibrated value override this with server.use().
  http.get(`${API_BASE}/api/train/timing-profile`, () =>
    HttpResponse.json({
      leadInSeconds: 480,
      setCycleCompoundSeconds: 180,
      setCycleIsolationSeconds: 125,
      transitionSeconds: 240,
      samples: { leadIn: 0, setCycleCompound: 0, setCycleIsolation: 0, transition: 0 },
    }),
  ),
  http.post(`${API_BASE}/api/train/sport-sessions`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { id: 'd1f3a0e2-0000-4000-8000-00000000cafe', sport: 'volleyball', date: '2026-06-12', time: '18:00', ...body },
      { status: 201 },
    )
  }),
  http.put(`${API_BASE}/api/train/sport-schedule`, async ({ request }) => {
    const slots = (await request.json()) as Array<Record<string, unknown>>
    return HttpResponse.json(slots.map((s, i) => ({ id: `e1f3a0e2-0000-4000-8000-0000000000${60 + i}`, ...s })))
  }),
  http.post(`${API_BASE}/api/train/sport-events`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { id: 'e3f3a0e2-0000-4000-8000-000000000090', kind: 'training', sport: 'volleyball', ...body },
      { status: 201 },
    )
  }),
  http.delete(`${API_BASE}/api/train/sport-events/:id`, () => new HttpResponse(null, { status: 204 })),
  http.put(`${API_BASE}/api/train/gym-schedule`, async ({ request }) => {
    const slots = (await request.json()) as Array<Record<string, unknown>>
    return HttpResponse.json(slots.map((s, i) => ({ id: `e2f3a0e2-0000-4000-8000-0000000000${70 + i}`, ...s })))
  }),
  // R3 running endpoints — default empty so real-mode Mai stays clean (no active
  // block ⇒ no run hero/lanes). Tests override with server.use() when they need data.
  http.get(`${API_BASE}/api/train/running-blocks`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/train/run-sessions`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/train/run-sessions`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: 'rs-f1f3a0e2-0000-4000-8000-00000000beef', ...body }, { status: 201 })
  }),

  // Recipe (mezo-lns) — defaults; tests override with server.use() for payload capture +
  // list-after-write. GET list/detail return the fixture; writes echo 201/204.
  http.get(`${API_BASE}/api/recipe`, () => HttpResponse.json({ recipes: [recipeFixture] })),
  // /logs + /breakdown registered before /:id so the segmented paths match deterministically.
  http.get(`${API_BASE}/api/recipe/:id/logs`, () => HttpResponse.json(recipeLogFixture)),
  http.get(`${API_BASE}/api/recipe/:id/breakdown`, () => HttpResponse.json(recipeBreakdownFixture)),
  http.get(`${API_BASE}/api/recipe/:id`, ({ params }) =>
    HttpResponse.json({ ...recipeFixture, id: String(params.id) }),
  ),
  http.post(`${API_BASE}/api/recipe`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...recipeFixture, ...body, id: 'rc1f3a0e2-0000-4000-8000-0000000000be' }, { status: 201 })
  }),
  http.put(`${API_BASE}/api/recipe/:id`, () => new HttpResponse(null, { status: 204 })),
  http.delete(`${API_BASE}/api/recipe/:id`, () => new HttpResponse(null, { status: 204 })),

  // Meal + fuel-day (mezo-arb) — defaults; tests override with server.use() for payload capture.
  http.get(`${API_BASE}/api/fuel/day/:date`, ({ params }) =>
    HttpResponse.json({ ...fuelDayFixture, date: String(params.date) }),
  ),
  // 7-day rollup (Fuel P4, mezo-kpo) — two logged days (Mon 2800 kcal protein-hit, Tue 2635
  // kcal below the 220 p target), the rest zero. kcal avg = 2717.5 → factor 2717.5/3100.
  http.get(`${API_BASE}/api/fuel/week/:start`, ({ params }) => {
    const start = String(params.start)
    const day = (offset: number, consumed: { kcal: number; p: number; c: number; f: number; water: number }) => {
      const d = new Date(`${start}T00:00:00`)
      d.setDate(d.getDate() + offset)
      return { date: d.toISOString().slice(0, 10), targets: fuelDayFixture.targets, consumed }
    }
    const zero = { kcal: 0, p: 0, c: 0, f: 0, water: 0 }
    return HttpResponse.json({
      start,
      days: [
        day(0, { kcal: 2800, p: 225, c: 300, f: 80, water: 2500 }),
        day(1, { kcal: 2635, p: 180, c: 290, f: 75, water: 2000 }),
        day(2, zero), day(3, zero), day(4, zero), day(5, zero), day(6, zero),
      ],
    })
  }),
  http.post(`${API_BASE}/api/meal`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...mealFixture, ...body, id: 'me1f3a0e2-0000-4000-8000-0000000000be' }, { status: 201 })
  }),
  http.put(`${API_BASE}/api/meal/:id`, () => new HttpResponse(null, { status: 204 })),
  http.delete(`${API_BASE}/api/meal/:id`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_BASE}/api/water-log`, () =>
    HttpResponse.json({ id: 'w1', date: '2026-07-02', amountMl: 250 }, { status: 201 })),

  // Medication (mezo-d94) — defaults; tests override with server.use() for payload capture.
  // GET day returns the fixture; POST dose echoes a new dose; DELETE dose / PUT med 204/200.
  http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationDayFixture)),
  http.post(`${API_BASE}/api/medication/:medId/dose`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { id: 'dose-new', administeredAt: '2026-06-26T07:00:00', dose: 6, note: null, ...body },
      { status: 201 },
    )
  }),
  http.delete(`${API_BASE}/api/medication/:medId/dose/:doseId`, () => new HttpResponse(null, { status: 204 })),
  http.put(`${API_BASE}/api/medication/:medId`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...medicationDayFixture.medication, ...body })
  }),

  // Pantry — honest-empty default (ingredients + stash + P6 imports/suggestions); tests
  // override with server.use() when they need a populated stash or feed.
  http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({ ingredients: [], stash: [], imports: [], suggestions: [] })),

  // Pantry import (P6, mezo-bka) — confirmed-draft import.
  // URL scrape (P8, mezo-8vum) — honest-empty default; tests override with server.use().
  http.post(`${API_BASE}/api/pantry-import/scrape`, () => HttpResponse.json({ result: null })),
  // Photo import (mezo-d8tr) — honest-empty default; tests override with server.use().
  http.post(`${API_BASE}/api/pantry-import/photo`, () => HttpResponse.json({ result: null })),
  http.post(`${API_BASE}/api/pantry-import`, async ({ request }) => {
    const body = (await request.json()) as { name: string }
    return HttpResponse.json(
      { id: 'imported-1', kind: 'food', name: body.name, source: 'openfoodfacts' },
      { status: 201 },
    )
  }),

  // Fuel Stack/Protocol (mezo-09g, mezo-vx9v) — honest-empty defaults; tests override with
  // server.use(). GET protocol → no active protocol yet (ghost); GET intake/:date → no intakes;
  // POST intake echoes a row; DELETE intake entry → 204. Occurrence ops (POST/PATCH/DELETE
  // /api/fuel/protocol/items[/:id]) have no default — every test exercising them supplies its own
  // server.use() handler.
  http.get(`${API_BASE}/api/fuel/protocol`, () => HttpResponse.json({ history: [] })),
  http.get(`${API_BASE}/api/fuel/intake/:date`, () => HttpResponse.json({ intakes: [] })),
  http.post(`${API_BASE}/api/fuel/intake`, async ({ request }) => {
    const body = (await request.json()) as { pantryItemId: string; dose?: string; slotKey?: string }
    return HttpResponse.json(
      { id: 'intake-new', pantryItemId: body.pantryItemId, takenAt: '2026-07-02T07:00:00Z', takenDate: '2026-07-02', dose: body.dose, slotKey: body.slotKey },
      { status: 201 },
    )
  }),
  http.delete(`${API_BASE}/api/fuel/intake/entry/:id`, () => new HttpResponse(null, { status: 204 })),

  // Fuel planner settings (mezo-53su) — config-default ghost; PUT echoes the saved body.
  http.get(`${API_BASE}/api/fuel/settings`, () =>
    HttpResponse.json({ mealsPerDay: 4, caffeineCutoff: '14:00' })),
  http.put(`${API_BASE}/api/fuel/settings`, async ({ request }) =>
    HttpResponse.json(await request.json())),

  // Mezo-kalauz seen-store (mezo-gb1s.1) — empty ghost; PUT replaces, DELETE clears. In-memory (module-
  // level, not closure-local) so a test's PUT is visible to its next GET; `server.resetHandlers()` does
  // NOT reset this state (it only re-registers handlers), so `src/test/setup.ts` also calls
  // `resetTutorialProgressState()` in its own `afterEach` to stop one test's PUT leaking into the next.
  http.get(`${API_BASE}/api/tutorial/progress`, () => HttpResponse.json({ progress: tutorialProgressState })),
  http.put(`${API_BASE}/api/tutorial/progress`, async ({ request }) => {
    tutorialProgressState = ((await request.json()) as { progress: Record<string, unknown> }).progress
    return HttpResponse.json({ progress: tutorialProgressState })
  }),
  http.delete(`${API_BASE}/api/tutorial/progress`, () => { tutorialProgressState = {}; return new HttpResponse(null, { status: 204 }) }),

  // Fuel meal-slot templates (mezo-7102) — honest-empty default list; PUT echoes the
  // saved body under the path dayType, DELETE is a plain 204. Tests override with server.use().
  http.get(`${API_BASE}/api/fuel/slot-templates`, () => HttpResponse.json({ templates: [] })),
  http.put(`${API_BASE}/api/fuel/slot-templates/:dayType`, async ({ params, request }) =>
    HttpResponse.json({ dayType: params.dayType, ...(await request.json() as object) })),
  http.delete(`${API_BASE}/api/fuel/slot-templates/:dayType`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_BASE}/api/fuel/slot-templates/evaluate`, () =>
    HttpResponse.json({ verdict: 'ok', summary: 'Teszt értékelés.', suggestions: [] })),

  // Companion chat (V0.4) — fixtures mirror the mock seed (initialChat) so page/hook tests
  // assert the same strings in both modes. Tests exercise switch-off by overriding the
  // conversation list with a 404 (server.use).
  http.get(`${API_BASE}/api/companion/conversation`, () =>
    HttpResponse.json([
      { id: 'c-1', title: 'Aludtam 7h-t…', startedAt: '2026-07-03T06:32:00Z', lastMessageAt: '2026-07-03T06:34:00Z' },
    ]),
  ),
  http.post(`${API_BASE}/api/companion/conversation`, () =>
    HttpResponse.json({ id: 'c-new', title: null, startedAt: '2026-07-03T07:00:00Z', lastMessageAt: null }, { status: 201 }),
  ),
  http.get(`${API_BASE}/api/companion/conversation/:id/messages`, () =>
    HttpResponse.json(
      initialChat.map((m, i) => ({
        id: `msg-${i}`,
        role: m.role,
        content: m.text,
        createdAt: `2026-07-03T06:3${i}:00Z`,
        tools: m.tools ?? [],
        refs: m.refs ?? [],
        recalled: m.recalled ?? [],
        degraded: false,
      })),
    ),
  ),
  // Companion knowledge facts (V1.2) — wire fixtures mirror the mock seeds so page/hook
  // tests assert the same strings in both modes. Stateless by design: tests that need a
  // mutating flow (accept → refetch without the candidate) override with server.use.
  http.get(`${API_BASE}/api/companion/fact`, () =>
    HttpResponse.json(
      knowledgeSeed.map((f) => ({
        id: f.id,
        factText: f.text,
        category: f.category,
        source: f.source,
        reinforcementCount: f.reinforced,
        includeInPrompt: f.active,
        lastReinforcedAt: f.lastReinforcedAt,
        createdAt: f.createdAt,
        patternTitle: f.patternTitle ?? null,
      })),
    ),
  ),
  http.get(`${API_BASE}/api/companion/fact/candidate`, () =>
    HttpResponse.json(
      candidateSeed.map((c, i) => ({
        id: c.id,
        candidateText: c.text,
        category: c.category,
        userDecision: null,
        refinedText: null,
        promotedFactId: null,
        createdAt: `2026-07-03T06:0${i}:00Z`,
      })),
    ),
  ),
  // Companion patterns (V3.1) — wire fixtures mirror the mock seeds (proposed, hypothesis-shaped).
  http.get(`${API_BASE}/api/companion/pattern`, () =>
    HttpResponse.json(
      patternSeed.map((p) => ({
        id: p.id,
        kind: 'ai_hypothesis',
        category: p.category,
        categoryLabel: p.categoryLabel,
        title: p.title,
        mechanism: p.mechanism,
        evidence: p.evidence,
        confidence: p.confidence,
        critique: p.critique,
        status: 'proposed',
        lastDetectedAt: '2026-07-03T02:40:00Z',
      })),
    ),
  ),
  http.post(`${API_BASE}/api/companion/pattern/:id/decision`, async ({ params, request }) => {
    const body = (await request.json()) as { decision: 'confirm' | 'monitor' | 'reject' }
    const p = patternSeed.find((x) => x.id === params.id)
    if (!p) return HttpResponse.json([{ code: 'COMPANION_PATTERN_NOT_FOUND' }], { status: 404 })
    const status = body.decision === 'confirm' ? 'confirmed' : body.decision === 'monitor' ? 'monitoring' : 'rejected'
    return HttpResponse.json({
      id: p.id,
      kind: 'ai_hypothesis',
      category: p.category,
      categoryLabel: p.categoryLabel,
      title: p.title,
      mechanism: p.mechanism,
      evidence: p.evidence,
      confidence: p.confidence,
      critique: p.critique,
      status,
      lastDetectedAt: '2026-07-03T02:40:00Z',
    })
  }),
  http.get(`${API_BASE}/api/companion/pattern/monitor`, () =>
    HttpResponse.json({
      windowFrom: '2026-06-13',
      windowTo: '2026-08-10',
      lookbackDays: 60,
      minN: 8,
      cron: '0 40 2 * * *',
      lastRunAt: null,
      pairs: [],
      metrics: [],
    }),
  ),
  http.patch(`${API_BASE}/api/companion/fact/:id`, async ({ params, request }) => {
    const body = (await request.json()) as { includeInPrompt?: boolean; factText?: string; category?: string }
    const fact = knowledgeSeed.find((f) => f.id === params.id)
    if (!fact) return HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })
    return HttpResponse.json({
      id: fact.id,
      factText: body.factText ?? fact.text,
      category: body.category ?? fact.category,
      source: 'manual',
      reinforcementCount: fact.reinforced,
      includeInPrompt: body.includeInPrompt ?? fact.active,
      lastReinforcedAt: null,
      createdAt: '2026-07-01T06:00:00Z',
    })
  }),
  http.post(`${API_BASE}/api/companion/fact/candidate/:id/decision`, async ({ params, request }) => {
    const body = (await request.json()) as { decision: string; refinedText?: string }
    const candidate = candidateSeed.find((c) => c.id === params.id)
    if (!candidate) return HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })
    return HttpResponse.json({
      id: candidate.id,
      candidateText: candidate.text,
      category: candidate.category,
      userDecision: body.decision,
      refinedText: body.refinedText ?? null,
      promotedFactId: body.decision === 'reject' ? null : `kf-${candidate.id}`,
      createdAt: '2026-07-03T06:00:00Z',
    })
  }),

  http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, async ({ request }) => {
    const { content } = (await request.json()) as { content: string }
    const reply = cannedReply(content)
    const mid = Math.ceil(reply.length / 2)
    const encoder = new TextEncoder()
    const frame = (event: string, data: unknown) => `event:${event}\ndata:${JSON.stringify(data)}\n\n`
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(frame('tool', { type: 'read', name: 'get_recovery(days=3)' })))
        controller.enqueue(encoder.encode(frame('delta', { text: reply.slice(0, mid) })))
        controller.enqueue(encoder.encode(frame('delta', { text: reply.slice(mid) })))
        // V0.5: the done event carries the persisted assistant row's REAL chips — name bakes
        // the args in ("get_recovery(days=3)"), refs are the tool-contributed data references
        controller.enqueue(encoder.encode(frame('done', {
          id: 'msg-done', role: 'assistant', content: reply,
          createdAt: '2026-07-03T07:00:05Z',
          tools: [{ type: 'read', name: 'get_recovery(days=3)' }],
          refs: [{ kind: 'Sleep', id: '2026-07-02' }],
          // W3.1b: the persisted row also carries what ambient recall fed the prompt
          recalled: [{
            occurredOn: '2026-07-01', kind: 'journal_entry', label: 'napló',
            gist: 'korábban is rosszul aludtál edzés után', similarity: 0.88,
          }],
          degraded: false,
        })))
        controller.close()
      },
    })
    return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
  }),

  http.get(`${API_BASE}/api/companion/memory/overview`, () =>
    HttpResponse.json({
      l0: { daysWithAnyData: 0, windowDays: 60 },
      l1: { summaryCount: 0, firstDate: null, lastDate: null, embeddings: [] },
      l2: { patterns: [], pendingFactCandidates: 0 },
      l3: { facts: [], totalReinforcements: 0, factsInPrompt: 0 },
      jobs: {
        summaryCron: '0 20 2 * * *',
        patternCron: '0 40 2 * * *',
        hypothesisCron: '0 0 3 * * SUN',
        lastSummaryDate: null,
        lastDetectedAt: null,
      },
    }),
  ),
  http.get(`${API_BASE}/api/companion/memory/summary`, () => HttpResponse.json({ items: [] })),
  http.get(`${API_BASE}/api/companion/memory/similar-days`, () => HttpResponse.json({ items: [] })),
  http.get(`${API_BASE}/api/companion/memory/llm-usage`, () =>
    HttpResponse.json({
      enabled: false, perDay: [],
      totals: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: null },
    }),
  ),

  // Journal (mezo-b3pp.1) — honest-empty default list; create/update echo a
  // JournalEntryResponse-shaped row, delete is a plain 204. Tests override with server.use().
  http.get(`${API_BASE}/api/journal`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/journal`, async ({ request }) => {
    const body = (await request.json()) as { text: string; occurredOn?: string; source: string }
    return HttpResponse.json(
      {
        id: 'jn-new',
        occurredOn: body.occurredOn ?? '2026-08-18',
        text: body.text,
        source: body.source,
        createdAt: '2026-08-18T12:00:00Z',
      },
      { status: 201 },
    )
  }),
  http.put(`${API_BASE}/api/journal/:id`, async ({ params, request }) => {
    const body = (await request.json()) as { text: string; occurredOn?: string }
    return HttpResponse.json({
      id: String(params.id),
      occurredOn: body.occurredOn ?? '2026-08-18',
      text: body.text,
      source: 'quickinput',
      createdAt: '2026-08-18T12:00:00Z',
    })
  }),
  http.delete(`${API_BASE}/api/journal/:id`, () => new HttpResponse(null, { status: 204 })),

  // Gratitude (mezo-b3pp.3) — honest-empty default list, echo on create, 204 on delete.
  // Without these, real-mode reads of /api/journal/gratitude hit MSW's 'bypass' fallthrough
  // (test/setup.ts) and resolve via a real network error instead of exercising this handler.
  http.get(`${API_BASE}/api/journal/gratitude`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/journal/gratitude`, async ({ request }) => {
    const b = (await request.json()) as { text: string; lifeArea?: string | null; occurredOn?: string }
    return HttpResponse.json({ id: 'gratitude-new', occurredOn: b.occurredOn ?? '2026-08-21', text: b.text,
      lifeArea: b.lifeArea ?? null, createdAt: '2026-08-21T20:00:00Z' }, { status: 201 })
  }),
  http.delete(`${API_BASE}/api/journal/gratitude/:id`, () => new HttpResponse(null, { status: 204 })),

  // Decisions (mezo-b3pp.4) — honest-empty default list, mirroring the journal-notes default
  // above; without this, real-mode reads of /api/journal/decision hit MSW's 'bypass' fallthrough
  // (test/setup.ts) and resolve via a real network error instead of exercising this handler.
  // Tests override with server.use() for anything beyond the empty-list default.
  http.get(`${API_BASE}/api/journal/decision`, () => HttpResponse.json([])),

  // Companion feedback (mezo-b3pp.15) — honest-empty default batch read; the PUT echoes the body
  // back as the stored MessageFeedbackResponse row and the retraction is a plain 204. Without
  // these, every real-mode test that renders a 👍/👎 surface falls through MSW's 'bypass'
  // (test/setup.ts) into a live connection attempt to localhost:8090 — slow and flaky. Tests that
  // need actual verdicts override with server.use().
  http.get(`${API_BASE}/api/companion/feedback`, () => HttpResponse.json([])),
  http.put(`${API_BASE}/api/companion/feedback`, async ({ request }) => {
    const body = (await request.json()) as {
      artifactKind: string
      artifactId: string
      verdict: string
      reason?: string | null
    }
    return HttpResponse.json({ ...body, reason: body.reason ?? null, updatedAt: '2026-08-21T12:00:00Z' })
  }),
  http.delete(`${API_BASE}/api/companion/feedback/:artifactKind/:artifactId`, () => new HttpResponse(null, { status: 204 })),

  // Weekly review (mezo-p2tr) — one fetched week, DELIBERATELY distinct from the mock seed
  // (`meWeek.ts`) so real-mode tests can tell "the fetch resolved" apart from "the seed leaked".
  // A day with no data (score: null) reports checkinCount/workoutCount: 0, never omitted fields.
  http.get(`${API_BASE}/api/me/week/:start`, ({ params }) => {
    const start = params.start as string
    const empty = (offset: number) => ({
      date: addDays(start, offset), score: null, subscores: { sleep: null, fuel: null, checkin: null, activity: null },
      kcal: null, proteinG: null, carbsG: null, fatG: null, kcalTarget: 3000, proteinTargetG: 200,
      weightKg: null, sleepMin: null, sleepQuality: null, checkinCount: 0, checkinEnergyAvg: null,
      workoutCount: 0, xp: null,
    })
    return HttpResponse.json({
      start,
      // contract: always exactly 7 days (start..start+6) — one distinct-from-seed logged day,
      // the rest honest-empty (the /api/fuel/week/:start handler above is the house precedent).
      days: [
        { date: start, score: 65, subscores: { sleep: 60, fuel: 70, checkin: 62, activity: 68 },
          kcal: 2800, proteinG: 190, carbsG: 300, fatG: 80, kcalTarget: 3000, proteinTargetG: 200,
          weightKg: 82.5, sleepMin: 410, sleepQuality: 6, checkinCount: 3, checkinEnergyAvg: 6,
          workoutCount: 1, xp: 90 },
        empty(1), empty(2), empty(3), empty(4), empty(5), empty(6),
      ],
      weekly: {
        score: 65, prevWeekScore: 60, avgKcal: 2800, avgProteinG: 190, avgSleepMin: 410,
        avgCheckinEnergy: 6, checkinRatio: 0.5, latestWeightKg: 82.5, weightWeeklyRateKg: -0.2,
        totalXp: 90,
      },
    })
  }),

  // Weekly review (mezo-p2tr) — 404-default GET (the weekly-suggestion idiom above: no row
  // exists for most weeks until the WeeklyReviewJob writes one); tests that want a generated
  // review override with server.use(). Regenerate always succeeds with a fresh row. The digest
  // is contractually never a 404 — the default here is deliberately distinct from the mock seed
  // (the me/week handler's precedent) so real-mode tests can tell "fetch resolved" apart from
  // "the mock seed leaked".
  http.get(`${API_BASE}/api/proactive/weekly-review/:start`, () => new HttpResponse(null, { status: 404 })),
  http.post(`${API_BASE}/api/proactive/weekly-review/:start/regenerate`, ({ params }) => {
    const start = params.start as string
    return HttpResponse.json({
      id: 'e2b1c3d4-5f6a-4b7c-8d9e-0a1b2c3d4e5f',
      weekStart: start,
      summary: 'Frissített elemzés: a hét adatai alapján ez a legutóbbi kiértékelés.',
      dayNotes: [],
      highlights: [],
      generatedAt: '2026-08-27T06:00:00Z',
      stale: false,
    })
  }),
  // A hét tanulságai (mezo-d20.6.10) — the weekly knowledge-candidate read handoff §6.2
  // specifies. F6.5 has NOT shipped it, so the default is a 404: exactly what a real client
  // gets today, and exactly what the page must render as "nincs javaslat ehhez a héthez".
  // Tests that want the lit-up page override with server.use().
  http.get(`${API_BASE}/api/proactive/weekly-review/:start/lessons`, () => new HttpResponse(null, { status: 404 })),
  http.get(`${API_BASE}/api/proactive/weekly-review/:start/digest`, ({ params }) => {
    const start = params.start as string
    return HttpResponse.json({
      patterns: [{ pairKey: 'sleep_workout', title: 'Real-mode pattern', event: 'confirmed' }],
      newFacts: [{ id: 'f1e2d3c4-b5a6-4978-8675-3021abcdef01', text: 'Real-mode fact.' }],
      lifeEvents: [{ id: 'a1b2c3d4-e5f6-4708-9182-736455443322', title: 'Real-mode life event', occurredOn: start }],
      memoir: true,
      predictions: [{ id: '12345678-90ab-4cde-8f01-234567890abc', title: 'Real-mode prediction', status: 'pending' }],
    })
  }),
  // Karakter dossier (mezo-1gim.13, fix round 1) — real-mode default handlers so navigation.test.tsx
  // (and any other test that renders these pages WITHOUT stubbing @/data/hooks) gets an honest
  // PRE-BOOTSTRAP dossier instead of an unhandled request resolving to a false 404/degraded row.
  // Seeded to the same "untouched dossier" shape as the mock's own MOCK_OVERVIEW_EMPTY (CORE dims
  // at maturity 0, portrait '', topClaims []) so `isDossierEmpty()` holds and the bootstrap-intro
  // face renders — the one shared predicate the hub/Én-tile both key off. Per-test server.use()
  // overrides still take priority (msw resolves the LAST matching handler first).
  http.get(`${API_BASE}/api/character`, () => HttpResponse.json(MOCK_OVERVIEW_EMPTY)),
  http.get(`${API_BASE}/api/character/dimension/:key`, ({ params }) => {
    const dim = MOCK_DIMENSIONS[params.key as string]
    return dim != null ? HttpResponse.json(dim) : new HttpResponse(null, { status: 404 })
  }),
  http.get(`${API_BASE}/api/character/experts`, () => HttpResponse.json({ experts: MOCK_EXPERTS })),
  http.get(`${API_BASE}/api/character/feed`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/character/conference`, () => HttpResponse.json([])),
  // Gépterem (mezo-1gim.14): the run-log timeline writer runs on CHARACTER_SWITCH alone, not on
  // the dossier's bootstrap state (Task 1's writer wiring runs from the nightly/weekly/monthly/
  // bootstrap pipelines regardless of whether the user has bootstrapped their dossier yet) — so,
  // unlike the empty-overview default above, these two are served FULLY from the seeded run log,
  // consistent with "the pipelines' own switch combinations [are] unchanged" (Global Constraints).
  http.get(`${API_BASE}/api/character/runs`, ({ request }) => {
    const url = new URL(request.url)
    const from = url.searchParams.get('from') ?? ''
    const to = url.searchParams.get('to') ?? ''
    return HttpResponse.json(MOCK_RUNS.filter((r) => r.day >= from && r.day <= to))
  }),
  http.get(`${API_BASE}/api/character/run/:id`, ({ params }) => {
    const detail = MOCK_RUN_DETAIL[params.id as string]
    return detail != null ? HttpResponse.json(detail) : new HttpResponse(null, { status: 404 })
  }),

  // Life goals (mezo-iizd.1) — default fixtures mirroring the mock seed so real-mode component
  // tests that render these hooks without a per-test server.use() get the same four goals.
  http.get(`${API_BASE}/api/life-goals`, () => HttpResponse.json(MOCK_LIFE_GOALS)),
  // NOTE: the static `signals` / `propose` / `today` paths MUST stay ahead of the `:id` handlers
  // below — MSW resolves in registration order and `/signals` (etc.) also matches `/api/life-goals/:id`.
  http.get(`${API_BASE}/api/life-goals/signals`, () => HttpResponse.json({ entries: MOCK_SIGNAL_CATALOG })),
  http.post(`${API_BASE}/api/life-goals/propose`, async ({ request }) =>
    HttpResponse.json(mockPropose((await request.json()) as LifeGoalProposeRequest))),
  http.get(`${API_BASE}/api/life-goals/today`, () => HttpResponse.json(mockToday())),
  // The create handler ECHOES the submitted frame/pillars/ifThenPlans (assigning ids/positions)
  // exactly as LifeGoalService.create does — it used to hard-override all three to empty after
  // spreading the body, so a real-mode wizard test saw a goal the backend would never return.
  http.post(`${API_BASE}/api/life-goals`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(lifeGoalEcho({ ...body, id: 'lg-new', status: 'draft' }), { status: 201 })
  }),
  http.get(`${API_BASE}/api/life-goals/:id`, ({ params }) => {
    const g = findLifeGoal(params.id as string)
    return g != null ? HttpResponse.json(g) : new HttpResponse(null, { status: 404 })
  }),
  http.put(`${API_BASE}/api/life-goals/:id`, async ({ params, request }) => {
    const g = findLifeGoal(params.id as string)
    if (g == null) return new HttpResponse(null, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    // PUT /{id} does NOT touch status or pillars (their own endpoints own them) — LifeGoalService.update.
    return HttpResponse.json(lifeGoalEcho({ ...g, ...body, status: g.status, pillars: g.pillars }))
  }),
  http.put(`${API_BASE}/api/life-goals/:id/pillars`, async ({ params, request }) => {
    const g = findLifeGoal(params.id as string)
    if (g == null) return new HttpResponse(null, { status: 404 })
    const body = (await request.json()) as { pillars?: unknown[] }
    return HttpResponse.json(lifeGoalEcho({ ...g, pillars: body.pillars ?? [] }))
  }),
  http.delete(`${API_BASE}/api/life-goals/:id`, ({ params }) =>
    findLifeGoal(params.id as string) != null ? new HttpResponse(null, { status: 204 }) : new HttpResponse(null, { status: 404 })),
  http.post(`${API_BASE}/api/life-goals/:id/status`, async ({ params, request }) => {
    const g = findLifeGoal(params.id as string)
    if (g == null) return new HttpResponse(null, { status: 404 })
    const body = (await request.json()) as { status: string }
    const closing = body.status === 'done' || body.status === 'archived'
    return HttpResponse.json({
      ...g,
      status: body.status,
      activatedAt: body.status === 'active' ? (g.activatedAt ?? MSW_NOW) : g.activatedAt,
      closedAt: closing ? MSW_NOW : g.closedAt,
    })
  }),
  http.get(`${API_BASE}/api/life-goals/:id/progress`, ({ params }) =>
    findLifeGoal(params.id as string) != null
      ? HttpResponse.json(mockProgress(params.id as string))
      : new HttpResponse(null, { status: 404 })),
  http.post(`${API_BASE}/api/life-goals/:id/evaluate`, ({ params }) =>
    findLifeGoal(params.id as string) != null
      ? HttpResponse.json(mockProgress(params.id as string))
      : new HttpResponse(null, { status: 404 })),
]
