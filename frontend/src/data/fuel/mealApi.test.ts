import { afterEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mealApi, toRequest, fromResponse, fromBreakdown } from '@/data/fuel/mealApi'
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
    expect(meal.breakdown).toBeUndefined() // pre-scoring row → pending sparkle stays
    expect(meal.kcal).toBe(840)
    expect(meal.mealItems[0]).toMatchObject({ source: 'recipe', refId: 'rec-1', name: 'Túrós zabkása', nova: 3, contribution: { kcal: 580, p: 42, c: 78, f: 12 } })
    expect(meal.mealItems[1]).toMatchObject({ source: 'pantry', refId: 'p-zab', amount: 70, unit: 'g' })
  })

  it('maps a scored breakdown to the FE union: colors injected, a degraded dim KEPT base-fields-only (mezo-jcpt.1)', () => {
    const scored = {
      ...mealResponse,
      score: {
        value: 0.87,
        breakdown: {
          value: 0.87, confidence: 0.93, summary: null,
          dimensions: [
            {
              id: 'macro', label: 'Kcal & makró arány', weight: 0.3, score: 0.96, detail: 'P/C/F arány…',
              macro: { ratioP: 27, ratioC: 47, ratioF: 26, targetP: '~27%', targetC: '~47%', targetF: '~26%', kcalShareOfDay: 27.1, notes: null },
              micros: null, nova: null, context: null,
            },
            { // degraded micro: weight 0, no payload → since mezo-jcpt.1 this is KEPT
              // (ScoreLedger's "Nincs adat" line needs it), not dropped
              id: 'micro', label: 'Rost & mikro', weight: 0, score: 0, detail: 'Nincs tápanyag-adat.',
              macro: null, micros: null, nova: null, context: null,
            },
            {
              id: 'nova', label: 'Feldolgozottság · NOVA', weight: 0.25, score: 0.79, detail: 'Domináns NOVA 1…',
              macro: null, micros: null, context: null,
              nova: {
                dominant: 1,
                stack: [{ nova: 1, pct: 74, label: 'Zab' }, { nova: 2, pct: 0, label: '—' }, { nova: 3, pct: 0, label: '—' }, { nova: 4, pct: 26, label: 'Whey' }],
                items: [{ name: 'Zab 70g', nova: 1, warning: false }, { name: 'Whey 1adag', nova: 4, warning: true }],
              },
            },
            {
              id: 'context', label: 'Időzítés & kontextus', weight: 0.2, score: 0.9, detail: 'Időzítés…',
              macro: null, micros: null, nova: null,
              context: [{ label: 'Időzítés', value: '07:30 · reggeli ablakban' }],
            },
          ],
          improve: [], tools: [{ type: 'compute', name: 'macroFit(config)' }],
        },
      },
    }

    const meal = fromResponse(scored)

    expect(meal.score).toBe(0.87)
    expect(meal.breakdown).toBeDefined()
    expect(meal.breakdown!.summary).toBeNull()
    expect(meal.breakdown!.dimensions.map(d => d.id)).toEqual(['macro', 'micro', 'nova', 'context']) // degraded micro kept, in place
    expect(meal.breakdown!.dimensions[0]).toMatchObject({
      id: 'macro', color: 'var(--coral)',
      macroRatio: { p: 27, c: 47, f: 26 }, kcalShareOfDay: 27.1,
    })
    const micro = meal.breakdown!.dimensions[1]
    expect(micro).toMatchObject({ id: 'micro', color: 'var(--cat-physiology)', weight: 0, score: 0, label: 'Rost & mikro' })
    expect(micro).not.toHaveProperty('micros') // no per-kind payload — no panel to render from
    const nova = meal.breakdown!.dimensions[2]
    expect(nova).toMatchObject({ id: 'nova', color: 'var(--cat-tendency)' })
    expect(nova.id === 'nova' && 'nova' in nova && nova.nova.items[1].warning).toBe(true)
    expect(meal.breakdown!.tools[0]).toEqual({ type: 'compute', name: 'macroFit(config)' })
  })

  it('drops a MALFORMED dimension — weight > 0 with a missing payload is a backend bug, not degradation', () => {
    const scored = {
      ...mealResponse,
      score: {
        value: 0.5,
        breakdown: {
          value: 0.5, confidence: 0.5, summary: null,
          dimensions: [
            { // live (weight > 0) but its declared payload never arrived — malformed, still dropped
              id: 'micro', label: 'Rost & mikro', weight: 0.1, score: 0.5, detail: 'x',
              macro: null, micros: null, nova: null, context: null,
            },
          ],
          improve: [], tools: [],
        },
      },
    }

    const meal = fromResponse(scored)

    expect(meal.breakdown!.dimensions).toEqual([])
  })

  it('drops an UNKNOWN-id degraded dimension (id outside DIMENSION_COLOR — version skew, not a real dimension)', () => {
    const scored = {
      ...mealResponse,
      score: {
        value: 0,
        breakdown: {
          value: 0, confidence: 0, summary: null,
          dimensions: [
            { id: 'made_up_dim', label: 'x', weight: 0, score: 0, detail: 'x', macro: null, micros: null, nova: null, context: null },
          ],
          improve: [], tools: [],
        },
      },
    }

    const meal = fromResponse(scored)

    expect(meal.breakdown!.dimensions).toEqual([])
  })
})

describe('fromResponse — nutrients mapping (mezo-m6uv)', () => {
  it('carries the whole-meal nutrients rollup and lifts fiberG onto the meal for the Rost ring', () => {
    const withNutrients = {
      ...mealResponse,
      nutrients: { fiberG: 6.4, sugarG: null, saltG: 0.8, saturatedFatG: 5.6 },
    }

    const meal = fromResponse(withNutrients)

    expect(meal.nutrients).toEqual({ fiberG: 6.4, sugarG: null, saltG: 0.8, saturatedFatG: 5.6 })
    expect(meal.fiberG).toBe(6.4)
  })

  it('carries a per-line nutrients fact onto the mapped MealItemLine', () => {
    const withItemNutrients = {
      ...mealResponse,
      items: [
        { ...mealResponse.items[0], nutrients: { fiberG: 3.2, sugarG: 1.1, saltG: 0.4, saturatedFatG: 2.8 } },
        mealResponse.items[1],
      ],
    }

    const meal = fromResponse(withItemNutrients)

    expect(meal.mealItems[0].nutrients).toEqual({ fiberG: 3.2, sugarG: 1.1, saltG: 0.4, saturatedFatG: 2.8 })
  })

  it('yields all-null nutrients and a null (not zero) fiberG when the wire omits nutrients entirely', () => {
    const meal = fromResponse(mealResponse)

    expect(meal.nutrients).toEqual({ fiberG: null, sugarG: null, saltG: null, saturatedFatG: null })
    expect(meal.fiberG).toBeNull()
  })
})

describe('fromBreakdown — 8-dimension envelope rows dimensions (mezo-7797)', () => {
  it('maps a WHO rows dimension to a RowsDimension with the injected var(--sky) color; KEEPS a degraded new-id dimension (mezo-jcpt.1)', () => {
    const envelope = {
      value: 0.9, confidence: 0.9, summary: null,
      dimensions: [
        {
          id: 'who', label: 'Ajánlások · WHO', weight: 0.14, score: 0.9, detail: 'x',
          macro: null, micros: null, nova: null,
          context: [{ label: 'Cukor', value: '6 E%' }],
        },
        { // degraded new-id dimension: weight 0, empty context — kept (base fields only, no panel)
          id: 'portion', label: 'Adag-arány', weight: 0, score: 0, detail: 'Nincs adag-adat.',
          macro: null, micros: null, nova: null, context: [],
        },
      ],
      improve: [], tools: [],
    }

    const b = fromBreakdown(envelope)

    expect(b.dimensions.map(d => d.id)).toEqual(['who', 'portion']) // degraded portion kept, in place
    const who = b.dimensions[0]
    expect(who).toMatchObject({ id: 'who', color: 'var(--sky)', weight: 0.14, score: 0.9 })
    expect(who.id === 'who' && 'context' in who && who.context).toEqual([{ label: 'Cukor', value: '6 E%' }])
    const portion = b.dimensions[1]
    expect(portion).toMatchObject({ id: 'portion', color: 'var(--coral-deep)', weight: 0, score: 0, label: 'Adag-arány' })
    expect(portion).not.toHaveProperty('context') // no per-kind payload — no panel to render from
  })

  it('injects each new dimension its constant color', () => {
    const mk = (id: string) => ({
      id, label: id, weight: 0.1, score: 0.8, detail: 'd',
      macro: null, micros: null, nova: null, context: [{ label: 'a', value: 'b' }],
    })
    const envelope = {
      value: 0.8, confidence: 0.8, summary: null,
      dimensions: [mk('who'), mk('fat_quality'), mk('plant_diversity'), mk('energy_density'), mk('portion')],
      improve: [], tools: [],
    }
    const colors = Object.fromEntries(fromBreakdown(envelope).dimensions.map(d => [d.id, d.color]))
    expect(colors).toEqual({
      who: 'var(--sky)',
      fat_quality: 'var(--amber-deep)',
      plant_diversity: 'var(--sage-deep)',
      energy_density: 'var(--lav)',
      portion: 'var(--coral-deep)',
    })
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

describe('toRequest ingredientOverrides', () => {
  const base: MealInput = {
    slot: 'lunch', loggedAt: null, title: 'Ebéd',
    items: [{ source: 'recipe', refId: 'rec-1', amount: 1, unit: 'adag' }],
  }

  it('omits the field entirely when nothing was overridden', () => {
    const item = toRequest(base).items[0] as Record<string, unknown>
    expect(item.ingredientOverrides).toBeUndefined()
  })

  it('passes the overrides through untouched', () => {
    const withOv: MealInput = {
      ...base,
      items: [{ source: 'recipe', refId: 'rec-1', amount: 1, unit: 'adag',
        ingredientOverrides: [{ lineOrder: 1, pantryItemId: 'p-9', amount: 0.5 }] }],
    }
    expect(toRequest(withOv).items[0].ingredientOverrides).toEqual(
      [{ lineOrder: 1, pantryItemId: 'p-9', amount: 0.5 }])
  })
})
