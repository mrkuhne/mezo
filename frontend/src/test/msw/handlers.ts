import { http, HttpResponse } from 'msw'
import { API_BASE } from '@/lib/api'

// Re-exported so hook tests keep importing it from here.
export { API_BASE }

// Recipe fixture (mezo-lns) mirroring the RecipeResponse contract — one breakfast recipe with
// two pantry-item lines (computed name + contribution, lineOrder, nullable mezoFit.score).
const recipeFixture = {
  id: 'rc1f3a0e2-0000-4000-8000-000000000001',
  name: 'Túrós zabkása · áfonyával', slot: 'Reggeli', category: 'breakfast',
  servings: 1, prepMins: 5, cookMins: 3, tags: ['high-protein', 'pre-workout'], starred: true,
  createdDate: 'Máj 14', novaDominant: 3, macros: { kcal: 580, p: 42, c: 78, f: 12 },
  mezoFit: { score: 0.92, fitsFor: ['Reggel · Reta D3'] },
  timesLogged: 0, avgScore: 0, lastLogged: '—',
  ingredients: [
    { pantryItemId: 'p-zab', amount: 70, unit: 'g', note: null, lineOrder: 0, name: 'Zabpehely', contribution: { kcal: 260, p: 9.5, c: 42, f: 4.9 } },
    { pantryItemId: 'p-turo', amount: 200, unit: 'g', note: null, lineOrder: 1, name: 'Túró', contribution: { kcal: 260, p: 36, c: 7, f: 10 } },
  ],
}

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

  http.get(`${API_BASE}/api/biometrics/checkin`, () => HttpResponse.json([])),
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
      exercises: [
        {
          id: 'c1f3a0e2-0000-4000-8000-000000000002', name: 'Chest Supported Row',
          muscle: 'back-mid', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound',
          lastWeek: { weightKg: 102.5, reps: 9, rir: 2 },
        },
      ],
      openWorkout: null,
    }),
  ),
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
      { id: 'f1e3a0e2-0000-4000-8000-000000000070', slug: 'chest-supported-row', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound', stim: 0.92, fatigue: 0.55 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000071', slug: 'hip-thrust', name: 'Hip Thrust', muscle: 'glute', type: 'compound', stim: 0.86, fatigue: 0.55 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000072', slug: 'box-jump', name: 'Box Jump', muscle: 'quad', type: 'plyo', stim: 0.6, fatigue: 0.35 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000073', slug: 'lateral-raise', name: 'Lateral Raise', muscle: 'shoulder', type: 'isolation', stim: 0.72, fatigue: 0.2 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000074', slug: 'standing-calf-raise', name: 'Standing Calf Raise', muscle: 'calf', type: 'isolation', stim: 0.72, fatigue: 0.2 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000075', slug: 'cable-crunch', name: 'Cable Crunch', muscle: 'core', type: 'isolation', stim: 0.72, fatigue: 0.2 },
    ]),
  ),
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
  http.get(`${API_BASE}/api/recipe/:id`, ({ params }) =>
    HttpResponse.json({ ...recipeFixture, id: String(params.id) }),
  ),
  http.post(`${API_BASE}/api/recipe`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...recipeFixture, ...body, id: 'rc1f3a0e2-0000-4000-8000-0000000000be' }, { status: 201 })
  }),
  http.put(`${API_BASE}/api/recipe/:id`, () => new HttpResponse(null, { status: 204 })),
  http.delete(`${API_BASE}/api/recipe/:id`, () => new HttpResponse(null, { status: 204 })),
]
