import { http, HttpResponse } from 'msw'
import { API_BASE } from '@/lib/api'

// Re-exported so hook tests keep importing it from here.
export { API_BASE }

export const handlers = [
  http.post(`${API_BASE}/api/auth/login`, () => HttpResponse.json({ token: 'test-token' })),

  http.get(`${API_BASE}/api/biometrics/weight`, () =>
    HttpResponse.json([{ id: 'w1', date: '2026-06-01', value: 82.5, note: null }]),
  ),
  http.post(`${API_BASE}/api/biometrics/weight`, async ({ request }) => {
    const body = (await request.json()) as { date: string; weightKg: number; note?: string | null }
    return HttpResponse.json(
      { id: 'w2', date: body.date, value: body.weightKg, note: body.note ?? null },
      { status: 201 },
    )
  }),

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
]
