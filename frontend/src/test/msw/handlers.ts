import { http, HttpResponse } from 'msw'

export const API_BASE = 'http://localhost:8080'

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
]
