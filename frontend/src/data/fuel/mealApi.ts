import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type {
  MealInput, MealInputItem, FuelMeal, MealItemLine, MacroSet,
  MealBreakdown, MealDimension, MicroStatus, ToolType,
} from '@/data/types'
import type { NovaGroup } from '@/data/nova'

type MealRequest = components['schemas']['MealRequest']
type MealItemRequest = components['schemas']['MealItemRequest']
type MealResponse = components['schemas']['MealResponse']
type MealItemResponse = components['schemas']['MealItemResponse']
type FuelDayResponse = components['schemas']['FuelDayResponse']
type FuelWeekResponse = components['schemas']['FuelWeekResponse']
type WaterLogRequest = components['schemas']['WaterLogRequest']
type MealBreakdownResponse = components['schemas']['MealBreakdown']
type MealScoreDimensionResponse = components['schemas']['MealScoreDimension']

/** Presentation-only dimension colors — deliberately NOT stored in the jsonb envelope (spec D3);
 *  constant per dimension id, matching the Phase-1 mock seeds. */
const DIMENSION_COLOR: Record<MealDimension['id'], string> = {
  macro: 'var(--brand-glow)',
  micro: 'var(--cat-physiology)',
  nova: 'var(--cat-tendency)',
  context: 'var(--cat-preference)',
}

/** Contract dimension → the FE discriminated union. A DEGRADED dimension (weight 0, no per-kind
 *  payload — zero input coverage on the backend) returns null and is dropped: the sheet shows
 *  only the dimensions that were actually computable (honest absence, never an empty fake panel). */
function fromDimension(d: MealScoreDimensionResponse): MealDimension | null {
  const base = {
    label: d.label,
    weight: d.weight,
    score: d.score,
    color: DIMENSION_COLOR[d.id as MealDimension['id']],
    detail: d.detail,
  }
  if (d.id === 'macro' && d.macro) {
    return {
      id: 'macro', ...base,
      macroRatio: { p: d.macro.ratioP, c: d.macro.ratioC, f: d.macro.ratioF },
      macroTargets: { p: d.macro.targetP, c: d.macro.targetC, f: d.macro.targetF },
      kcalShareOfDay: d.macro.kcalShareOfDay,
      notes: d.macro.notes ?? undefined,
    }
  }
  if (d.id === 'micro' && d.micros && d.micros.length > 0) {
    return {
      id: 'micro', ...base,
      micros: d.micros.map(m => ({ name: m.name, value: m.value, pct: m.pct, status: m.status as MicroStatus })),
    }
  }
  if (d.id === 'nova' && d.nova) {
    return {
      id: 'nova', ...base,
      nova: {
        dominant: d.nova.dominant as NovaGroup,
        stack: d.nova.stack.map(s => ({ nova: s.nova as NovaGroup, pct: s.pct, label: s.label })),
        items: d.nova.items.map(i => ({ name: i.name, nova: i.nova as NovaGroup, warning: i.warning || undefined })),
      },
    }
  }
  if (d.id === 'context' && d.context && d.context.length > 0) {
    return { id: 'context', ...base, context: d.context.map(c => ({ label: c.label, value: c.value })) }
  }
  return null
}

/** Contract envelope → FE MealBreakdown (colors injected; degraded dimensions dropped). */
export function fromBreakdown(b: MealBreakdownResponse): MealBreakdown {
  return {
    confidence: b.confidence,
    summary: b.summary ?? null,
    dimensions: b.dimensions.map(fromDimension).filter((d): d is MealDimension => d !== null),
    improve: b.improve.map(i => ({ text: i.text, impact: i.impact })),
    tools: b.tools.map(t => ({ type: t.type as ToolType, name: t.name })),
  }
}

/** What the composed useFuelDay needs from the server (targets/consumed/meals). */
export interface FuelDayData {
  date: string
  targets: MacroSet
  consumed: MacroSet
  meals: FuelMeal[]
}

/** One day of the 7-day rollup (`GET /api/fuel/week/{start}`) — no meal bodies. */
export interface FuelWeekDay {
  date: string
  targets: MacroSet
  consumed: MacroSet
}
export interface FuelWeekData {
  start: string
  days: FuelWeekDay[]
}

/** Editor input → contract request. The single `refId` is routed to recipeId | pantryItemId by
 *  source; the unused arm is sent as null so the server's exactly-one-of CHECK is satisfied. */
export function toRequest(input: MealInput): MealRequest {
  return {
    slot: input.slot,
    loggedAt: input.loggedAt ?? null,
    title: input.title ?? null,
    items: input.items.map((i: MealInputItem): MealItemRequest => ({
      source: i.source,
      recipeId: i.source === 'recipe' ? i.refId : null,
      pantryItemId: i.source === 'pantry' ? i.refId : null,
      amount: i.amount,
      unit: i.unit,
    })),
  } satisfies MealRequest
}

/** Contract response → domain FuelMeal. Re-keys each line's recipeId|pantryItemId → refId, lifts
 *  the macros rollup to flat kcal/p/c/f, and maps the deterministic score + breakdown envelope
 *  (mezo-yta); pre-scoring rows carry null/undefined → the pending sparkle stays. */
export function fromResponse(r: MealResponse): FuelMeal {
  return {
    id: r.id,
    slot: r.slot,
    title: r.title ?? '',
    score: r.score?.value ?? null,
    breakdown: r.score?.breakdown ? fromBreakdown(r.score.breakdown) : undefined,
    kcal: r.macros.kcal,
    p: r.macros.p,
    c: r.macros.c,
    f: r.macros.f,
    mealItems: r.items.map(
      (l: MealItemResponse): MealItemLine => ({
        source: l.source as MealItemLine['source'],
        refId: (l.source === 'recipe' ? l.recipeId : l.pantryItemId) ?? '',
        amount: l.amount,
        unit: l.unit,
        name: l.name,
        contribution: l.contribution,
        nova: l.nova ?? undefined,
      }),
    ),
    items: r.items.map(l => `${l.name} ${l.amount}${l.unit}`),
    tags: [],
    loggedAt: r.loggedAt,
    mealDate: r.mealDate,
  }
}

function fromDayResponse(d: FuelDayResponse): FuelDayData {
  return {
    date: d.date,
    targets: d.targets,
    consumed: d.consumed,
    meals: d.meals.map(fromResponse),
  }
}

export const mealApi = {
  getDay: (date: string): Promise<FuelDayData> =>
    apiFetch<FuelDayResponse>(`/api/fuel/day/${date}`).then(fromDayResponse),
  getWeek: (start: string): Promise<FuelWeekData> =>
    apiFetch<FuelWeekResponse>(`/api/fuel/week/${start}`).then((w) => ({
      start: w.start,
      days: w.days.map((d) => ({ date: d.date, targets: d.targets, consumed: d.consumed })),
    })),
  create: (input: MealInput): Promise<void> =>
    apiFetch('/api/meal', { method: 'POST', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  update: (id: string, input: MealInput): Promise<void> =>
    apiFetch(`/api/meal/${id}`, { method: 'PUT', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  remove: (id: string): Promise<void> =>
    apiFetch(`/api/meal/${id}`, { method: 'DELETE' }).then(() => undefined),
  logWater: (date: string, amountMl: number): Promise<void> =>
    apiFetch('/api/water-log', { method: 'POST', body: JSON.stringify({ date, amountMl } satisfies WaterLogRequest) }).then(() => undefined),
}
