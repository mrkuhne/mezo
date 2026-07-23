import { http, HttpResponse } from 'msw'
import { API_BASE } from '@/data/_client/api'
import { initialChat, cannedReply } from '@/data/insights/chat'
import { facts as knowledgeSeed, candidateSeed } from '@/data/insights/knowledge'
import { patterns as patternSeed } from '@/data/insights/insights'

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
  createdDate: 'Máj 14', novaDominant: 3, macros: { kcal: 580, p: 42, c: 78, f: 12 },
  mezoFit: { score: null, fitsFor: ['Reggel · Reta D3'] },
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

// Recipe template-breakdown fixture (mezo-bw3y) mirroring RecipeBreakdownResponse: the enriched
// envelope — 3 live dims (renormalized weights) + the degraded context card the template view keeps.
const recipeBreakdownFixture = {
  breakdown: {
    value: 0.91,
    confidence: 0.86,
    summary: 'MSW sablon-olvasat.',
    dimensions: [
      { id: 'macro', label: 'Kcal & makró arány', weight: 0.38, score: 0.92, detail: 'MSW makró detail.',
        macro: { ratioP: 30, ratioC: 40, ratioF: 30, targetP: '~27%', targetC: '~46%', targetF: '~27%', kcalShareOfDay: 24.5, notes: null } },
      { id: 'micro', label: 'Mikro–makro balance', weight: 0.31, score: 0.88, detail: 'MSW mikró detail.',
        micros: [{ name: 'Rost', value: '9.5 g', pct: 82, status: 'good' }] },
      { id: 'nova', label: 'Feldolgozottság · NOVA', weight: 0.31, score: 0.94, detail: 'MSW nova detail.',
        nova: { dominant: 1, stack: [{ nova: 1, pct: 100, label: 'Zab' }], items: [{ name: 'Zabpehely 70g', nova: 1, warning: false }] } },
      { id: 'context', label: 'Időzítés & kontextus', weight: 0, score: 0,
        detail: 'Sablon szinten nincs időzítési adat — a kontextust a logolt étkezéseknél értékeljük.', context: [] },
    ],
    improve: [{ text: 'MSW javaslat.', impact: '+rost' }],
    tools: [
      { type: 'compute', name: 'templateFit(weights_renormalized)' },
      { type: 'compute', name: 'llm:sablon-olvasat' },
    ],
  },
  fitsFor: ['Post-workout · este'],
}

// Medication day fixture (mezo-d94) mirroring MedicationDayResponse + the medicationSeed:
// the owner's single active Retatrutide on a 7-day cycle, derived cycle on retaDay 3 (stable),
// three most-recent weekly doses.
const medicationDayFixture = {
  medication: {
    id: 'med-reta', name: 'Retatrutide', activeIngredient: 'retatrutide', route: 'subQ',
    cadence: 'weekly-monday', defaultDose: 6, doseUnit: 'mg', active: true,
    cycle: {
      cycleLengthDays: 7,
      phases: [
        { key: 'peak', fromDay: 1, toDay: 2, label: 'Peak · étvágy ↓' },
        { key: 'stable', fromDay: 3, toDay: 5, label: 'Stabil · plató' },
        { key: 'trough', fromDay: 6, toDay: 7, label: 'Trough · étvágy ↑' },
      ],
    },
  },
  cycle: {
    retaDay: 3, phaseKey: 'stable', phaseLabel: 'Stabil · plató', lastDoseAt: '2026-06-22T07:00:00',
    week: [
      { day: 1, phaseKey: 'peak', label: 'Peak', current: false },
      { day: 2, phaseKey: 'peak', label: 'Peak', current: false },
      { day: 3, phaseKey: 'stable', label: 'Stabil', current: true },
      { day: 4, phaseKey: 'stable', label: 'Stabil', current: false },
      { day: 5, phaseKey: 'stable', label: 'Stabil', current: false },
      { day: 6, phaseKey: 'trough', label: 'Trough', current: false },
      { day: 7, phaseKey: 'trough', label: 'Trough', current: false },
    ],
  },
  recentDoses: [
    { id: 'dose-3', administeredAt: '2026-06-22T07:00:00', dose: 6, note: 'Hétfő reggel · subQ has' },
    { id: 'dose-2', administeredAt: '2026-06-15T07:10:00', dose: 6, note: null },
    { id: 'dose-1', administeredAt: '2026-06-08T07:05:00', dose: 6, note: null },
  ],
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

export const handlers = [
  http.post(`${API_BASE}/api/auth/login`, () => HttpResponse.json({ token: 'test-token' })),

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
      activityLevel: 'MODERATE',
      tdeeBootstrap: { bmr: 1910, tdee: 2960, pal: 1.55, formula: 'KATCH', computedAt: '2026-05-22T06:00:00Z' },
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
      { id: 's1', date: '2026-06-01', bedtime: '23:10', wakeup: '06:40', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 0, notes: null },
    ]),
  ),
  http.post(`${API_BASE}/api/biometrics/sleep`, async ({ request }) => {
    const body = (await request.json()) as {
      date: string; bedtime: string; wakeup: string; durationH: number
      quality: number; awakenings: number; note?: string | null
    }
    return HttpResponse.json(
      {
        id: 's2', date: body.date, bedtime: body.bedtime, wakeup: body.wakeup,
        duration: body.durationH, quality: body.quality, awakenings: body.awakenings,
        mealToSleep: 0, notes: body.note ?? null,
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

  // Proactive briefing (B1.2) — default: honest 404 "no generated briefing yet", so Today
  // tests keep rendering the labelled static fallback. Tests with a real briefing override
  // with server.use(http.get(..., () => HttpResponse.json(fixture))).
  http.get(`${API_BASE}/api/proactive/briefing`, () => new HttpResponse(null, { status: 404 })),

  // Proactive weekly suggestion (W1) — default: honest 404, the Weekly card keeps its placeholder.
  http.get(`${API_BASE}/api/proactive/weekly-suggestion`, () => new HttpResponse(null, { status: 404 })),

  // Weekly growth aggregate (E3, mezo-6ng8) — default: honest zeros (never a 404); the
  // GrowthWeekCard renders its "nincs growth-adat" empty line. Tests override with server.use(...).
  http.get(`${API_BASE}/api/progression/growth-week/:date`, ({ params }) =>
    HttpResponse.json({
      weekStart: params.date,
      questCompleted: 0,
      questClosed: 0,
      lifeXp: 0,
      activities: 0,
      savingsHuf: 0,
    })),

  // Proactive memoir (W2) — default: honest 404, MemoirPage renders its "készül" state.
  http.get(`${API_BASE}/api/proactive/memoir`, () => new HttpResponse(null, { status: 404 })),

  // Proactive heartbeat (H1) — default: honest 404, the Today CompanionNoteCard stays absent.
  http.get(`${API_BASE}/api/proactive/heartbeat`, () => new HttpResponse(null, { status: 404 })),

  // Proactive prediction (P1) — default: honest empty ARRAY (list endpoint, never 404); the
  // PredictionsPage renders its "still learning" null-state.
  http.get(`${API_BASE}/api/proactive/prediction`, () => HttpResponse.json([])),

  // Proactive experiment (P2) — default: honest empty ARRAY (list endpoint, never 404); the
  // ExperimentsPage renders its "still learning" null-state. Tests override with server.use(...).
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
  http.get(`${API_BASE}/api/people`, () => HttpResponse.json({ persons: [], mentions: [] })),

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
  http.post(`${API_BASE}/api/train/mesocycles`, () =>
    HttpResponse.json({ id: 'b6f3a0e2-0000-4000-8000-00000000beef' }, { status: 201 }),
  ),
  http.post(`${API_BASE}/api/train/mesocycles/:id/activate`, ({ params }) =>
    HttpResponse.json({ id: params.id }),
  ),
  http.post(`${API_BASE}/api/train/mesocycles/:id/close`, ({ params }) =>
    HttpResponse.json({ id: params.id }),
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
      { id: 'f1f3a0e2-0000-4000-8000-000000000030', exerciseId: 'c1f3a0e2-0000-4000-8000-000000000002', setIndex: 0 },
      { status: 201 },
    ),
  ),
  http.post(`${API_BASE}/api/train/workouts/:id/feedback`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_BASE}/api/train/workouts/:id/finish`, ({ params }) =>
    HttpResponse.json({
      id: String(params.id),
      templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
      date: '2026-06-12', status: 'completed', sets: [],
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
      { id: 'f1e3a0e2-0000-4000-8000-000000000071', slug: 'hip-thrust', name: 'Hip Thrust', muscle: 'glute', type: 'compound', stim: 0.86, fatigue: 0.55 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000072', slug: 'box-jump', name: 'Box Jump', muscle: 'quad', type: 'plyo', stim: 0.6, fatigue: 0.35 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000073', slug: 'lateral-raise', name: 'Lateral Raise', muscle: 'shoulder', type: 'isolation', stim: 0.72, fatigue: 0.2 },
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
      // Live-backend bodyweight shape (mezo-kaui): sets logged with weight 0 come
      // back as bestSet.weightKg 0 + bestE1rm 0 (NOT absent, unlike Box Jump above)
      // — the card must still render the rep-based bodyweight stat branch.
      {
        catalogId: 'f1e3a0e2-0000-4000-8000-000000000076',
        name: 'Dead Hang', muscle: 'lats', type: 'plyo',
        bestSet: { weightKg: 0, reps: 35, date: '2026-06-02' },
        bestE1rm: { value: 0, set: { weightKg: 0, reps: 35, date: '2026-06-02' } },
        totalVolume: 0, totalSets: 2, totalReps: 65, sessionCount: 1,
        repRecords: [{ weightKg: 0, reps: 35, date: '2026-06-02' }],
        recentTopSets: [{ weightKg: 0, reps: 35, date: '2026-06-02' }],
      },
    ]),
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

  // Pantry import (P6, mezo-bka) — OFF lookup proxy + confirmed-draft import.
  http.get(`${API_BASE}/api/pantry-import/lookup`, () => HttpResponse.json({ results: [] })),
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

  // Fuel Stack/Protocol (mezo-09g) — honest-empty defaults; tests override with server.use().
  // GET protocol → no active protocol yet (ghost); GET intake/:date → no intakes; POST protocol
  // echoes the posted selection as a v1 active ProtocolViewResponse; POST intake echoes a row;
  // DELETE intake entry → 204.
  http.get(`${API_BASE}/api/fuel/protocol`, () => HttpResponse.json({ history: [] })),
  http.get(`${API_BASE}/api/fuel/intake/:date`, () => HttpResponse.json({ intakes: [] })),
  http.post(`${API_BASE}/api/fuel/protocol`, async ({ request }) => {
    const body = (await request.json()) as { selectedPantryItemIds: string[]; reason?: string }
    return HttpResponse.json({
      active: {
        id: 'proto-1', version: 1, builtAt: '2026-07-02T06:00:00Z', status: 'active',
        confidence: 0.9, selectedPantryItemIds: body.selectedPantryItemIds,
      },
      history: [{ version: 1, builtAt: '2026-07-02T06:00:00Z', reason: body.reason }],
    })
  }),
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
        degraded: false,
      })),
    ),
  ),
  // Companion knowledge facts (V1.2) — wire fixtures mirror the mock seeds so page/hook
  // tests assert the same strings in both modes. Stateless by design: tests that need a
  // mutating flow (accept → refetch without the candidate) override with server.use.
  http.get(`${API_BASE}/api/companion/fact`, () =>
    HttpResponse.json(
      knowledgeSeed.map((f, i) => ({
        id: f.id,
        factText: f.text,
        category: f.category,
        source: 'manual',
        reinforcementCount: f.reinforced,
        includeInPrompt: f.active,
        lastReinforcedAt: null,
        createdAt: `2026-07-01T06:${String(i).padStart(2, '0')}:00Z`,
        patternTitle: null,
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
        controller.enqueue(encoder.encode(frame('delta', { text: reply.slice(0, mid) })))
        controller.enqueue(encoder.encode(frame('delta', { text: reply.slice(mid) })))
        // V0.5: the done event carries the persisted assistant row's REAL chips — name bakes
        // the args in ("get_sleep(days=3)"), refs are the tool-contributed data references
        controller.enqueue(encoder.encode(frame('done', {
          id: 'msg-done', role: 'assistant', content: reply,
          createdAt: '2026-07-03T07:00:05Z',
          tools: [{ type: 'read', name: 'get_sleep(days=3)' }],
          refs: [{ kind: 'Sleep', id: '2026-07-02' }],
          degraded: false,
        })))
        controller.close()
      },
    })
    return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
  }),
]
