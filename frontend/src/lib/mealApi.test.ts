import { afterEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mealApi, toRequest, fromResponse } from '@/lib/mealApi'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import type { MealInput } from '@/data/types'

const input: MealInput = {
  slot: 'breakfast', loggedAt: '2026-06-24T09:15:00', title: 'Reggeli',
  items: [
    { source: 'recipe', refId: 'rec-1', amount: 1, unit: 'adag' },
    { source: 'pantry', refId: 'p-zab', amount: 70, unit: 'g' },
  ],
}

const mealResponse = {
  id: 'm1', slot: 'breakfast', loggedAt: '2026-06-24T09:15:00', mealDate: '2026-06-24',
  title: 'Reggeli', macros: { kcal: 840, p: 51, c: 120, f: 17 },
  score: { value: null, breakdown: null },
  items: [
    { source: 'recipe', recipeId: 'rec-1', pantryItemId: null, amount: 1, unit: 'adag', lineOrder: 0, name: 'Túrós zabkása', nova: 3, contribution: { kcal: 580, p: 42, c: 78, f: 12 } },
    { source: 'pantry', recipeId: null, pantryItemId: 'p-zab', amount: 70, unit: 'g', lineOrder: 1, name: 'Zabpehely', nova: 1, contribution: { kcal: 260, p: 9, c: 42, f: 5 } },
  ],
}

const dayResponse = {
  date: '2026-06-24',
  targets: { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 },
  consumed: { kcal: 840, p: 51, c: 120, f: 17, water: 4000 },
  meals: [mealResponse],
}

afterEach(() => server.resetHandlers())

describe('toRequest', () => {
  it('routes refId to recipeId | pantryItemId by source', () => {
    const req = toRequest(input)
    expect(req.slot).toBe('breakfast')
    expect(req.loggedAt).toBe('2026-06-24T09:15:00')
    expect(req.items).toEqual([
      { source: 'recipe', recipeId: 'rec-1', pantryItemId: null, amount: 1, unit: 'adag' },
      { source: 'pantry', recipeId: null, pantryItemId: 'p-zab', amount: 70, unit: 'g' },
    ])
  })
})

describe('fromResponse', () => {
  it('re-keys each item to a MealItemLine (recipeId|pantryItemId → refId) and lifts macros to kcal/p/c/f', () => {
    const meal = fromResponse(mealResponse)
    expect(meal.id).toBe('m1')
    expect(meal.score).toBeNull()
    expect(meal.kcal).toBe(840)
    expect(meal.mealItems[0]).toMatchObject({ source: 'recipe', refId: 'rec-1', name: 'Túrós zabkása', nova: 3, contribution: { kcal: 580, p: 42, c: 78, f: 12 } })
    expect(meal.mealItems[1]).toMatchObject({ source: 'pantry', refId: 'p-zab', amount: 70, unit: 'g' })
  })
})

describe('mealApi', () => {
  it('getDay returns FuelDayData with mapped meals', async () => {
    server.use(http.get(`${API_BASE}/api/fuel/day/2026-06-24`, () => HttpResponse.json(dayResponse)))
    const day = await mealApi.getDay('2026-06-24')
    expect(day.date).toBe('2026-06-24')
    expect(day.targets.kcal).toBe(3100)
    expect(day.consumed.kcal).toBe(840)
    expect(day.meals[0].mealItems).toHaveLength(2)
  })

  it('create POSTs the mapped body and resolves void on 201', async () => {
    let body: unknown
    server.use(http.post(`${API_BASE}/api/meal`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(mealResponse, { status: 201 })
    }))
    await expect(mealApi.create(input)).resolves.toBeUndefined()
    expect((body as { items: unknown[] }).items).toHaveLength(2)
  })

  it('update PUTs to /api/meal/{id} and resolves void on 204', async () => {
    server.use(http.put(`${API_BASE}/api/meal/m1`, () => new HttpResponse(null, { status: 204 })))
    await expect(mealApi.update('m1', input)).resolves.toBeUndefined()
  })

  it('remove DELETEs /api/meal/{id} and resolves void on 204', async () => {
    server.use(http.delete(`${API_BASE}/api/meal/m1`, () => new HttpResponse(null, { status: 204 })))
    await expect(mealApi.remove('m1')).resolves.toBeUndefined()
  })
})
