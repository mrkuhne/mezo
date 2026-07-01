import { describe, it, expect } from 'vitest'
import { API_BASE } from '@/test/msw/handlers'

describe('meal MSW handlers (defaults)', () => {
  it('GET /api/fuel/day/:date returns targets/consumed/meals', async () => {
    const res = await fetch(`${API_BASE}/api/fuel/day/2026-06-24`)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.targets.kcal).toBe(3100)
    expect(body.consumed.kcal).toBe(580)
    expect(body.meals[0].items[0].pantryItemId).toBe('p-zab')
  })
  it('POST /api/meal echoes 201', async () => {
    const res = await fetch(`${API_BASE}/api/meal`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: 'snack', items: [] }),
    })
    expect(res.status).toBe(201)
  })
  it('GET /api/recipe/:id/logs returns recentLogs', async () => {
    const res = await fetch(`${API_BASE}/api/recipe/rec-1/logs`)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Array.isArray(body.recentLogs)).toBe(true)
    expect(body.recentLogs[0].mealId).toBeTruthy()
  })
})
// server is started by the global test setup (setupTests); no local lifecycle needed here.
