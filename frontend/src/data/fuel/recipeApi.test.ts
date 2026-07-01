import { afterEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { recipeApi, toRequest } from '@/data/fuel/recipeApi'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import type { RecipeInput } from '@/data/types'

const input: RecipeInput = {
  name: 'Túrós zabkása', slot: 'Reggeli', category: 'breakfast', servings: 1,
  prepMins: 5, cookMins: 3, tags: ['high-protein'], starred: true,
  ingredients: [
    { pantryItemId: 'p-zab', amount: 70, unit: 'g', note: null },
    { pantryItemId: 'p-turo', amount: 200, unit: 'g', note: 'félzsíros' },
  ],
}

const apiRecipe = {
  id: 'r1', name: 'Túrós zabkása', slot: 'Reggeli', category: 'breakfast',
  servings: 1, prepMins: 5, cookMins: 3, tags: ['high-protein'], starred: true,
  createdDate: 'Ma', novaDominant: 3, macros: { kcal: 580, p: 42, c: 78, f: 12 },
  mezoFit: { score: null, fitsFor: [] }, timesLogged: 0, avgScore: 0, lastLogged: '—',
  ingredients: [
    { pantryItemId: 'p-zab', amount: 70, unit: 'g', note: null, lineOrder: 0, name: 'Zab', contribution: { kcal: 260, p: 9, c: 42, f: 5 } },
    { pantryItemId: 'p-turo', amount: 200, unit: 'g', note: 'félzsíros', lineOrder: 1, name: 'Túró', contribution: { kcal: 260, p: 36, c: 7, f: 10 } },
  ],
}

afterEach(() => server.resetHandlers())

describe('toRequest', () => {
  it('maps the editor input straight onto the RecipeRequest (pantryItemId lines, category cast)', () => {
    const req = toRequest(input)
    expect(req.name).toBe('Túrós zabkása')
    expect(req.category).toBe('breakfast')
    expect(req.ingredients).toEqual([
      { pantryItemId: 'p-zab', amount: 70, unit: 'g', note: null },
      { pantryItemId: 'p-turo', amount: 200, unit: 'g', note: 'félzsíros' },
    ])
  })
})

describe('recipeApi', () => {
  it('list returns Recipe[] re-keyed to refId with name + contribution', async () => {
    server.use(http.get(`${API_BASE}/api/recipe`, () => HttpResponse.json({ recipes: [apiRecipe] })))
    const recipes = await recipeApi.list()
    expect(recipes).toHaveLength(1)
    expect(recipes[0].id).toBe('r1')
    expect(recipes[0].mezoFit.score).toBeNull()
    expect(recipes[0].ingredients[0]).toMatchObject({
      refId: 'p-zab', amount: 70, unit: 'g', name: 'Zab', contribution: { kcal: 260, p: 9, c: 42, f: 5 },
    })
  })

  it('get fetches one recipe by id', async () => {
    server.use(http.get(`${API_BASE}/api/recipe/r1`, () => HttpResponse.json(apiRecipe)))
    const recipe = await recipeApi.get('r1')
    expect(recipe.name).toBe('Túrós zabkása')
    expect(recipe.ingredients[1].refId).toBe('p-turo')
  })

  it('create POSTs the mapped request body and resolves void', async () => {
    let body: unknown
    server.use(http.post(`${API_BASE}/api/recipe`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(apiRecipe, { status: 201 })
    }))
    await expect(recipeApi.create(input)).resolves.toBeUndefined()
    expect((body as { name: string }).name).toBe('Túrós zabkása')
    expect((body as { ingredients: unknown[] }).ingredients).toHaveLength(2)
  })

  it('update PUTs to /api/recipe/{id} and resolves void on 204', async () => {
    server.use(http.put(`${API_BASE}/api/recipe/r1`, () => new HttpResponse(null, { status: 204 })))
    await expect(recipeApi.update('r1', input)).resolves.toBeUndefined()
  })

  it('remove DELETEs and resolves void on 204', async () => {
    server.use(http.delete(`${API_BASE}/api/recipe/r1`, () => new HttpResponse(null, { status: 204 })))
    await expect(recipeApi.remove('r1')).resolves.toBeUndefined()
  })
})
