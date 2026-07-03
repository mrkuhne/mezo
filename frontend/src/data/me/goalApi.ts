import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type GoalResponse = components['schemas']['GoalResponse']
export type GoalUpsertRequest = components['schemas']['GoalUpsertRequest']
export type FeasibilityPreviewRequest = components['schemas']['FeasibilityPreviewRequest']
export type FeasibilityPreviewResponse = components['schemas']['FeasibilityPreviewResponse']

// toRequest mapper — rebuild a full GoalUpsertRequest from a persisted
// GoalResponse so a partial edit (e.g. the day-planner settings) can PUT the
// whole contract without dropping the window/weights/guards it must round-trip.
// `rateTargetPctPerWeek` is intentionally omitted — the backend derives it (G6).
// Planner overrides win over the stored values (undefined = keep as-is).
export function goalResponseToUpsert(
  res: GoalResponse,
  planner?: { mealsPerDay?: number; wakeTime?: string; bedTime?: string },
): GoalUpsertRequest {
  return {
    title: res.title,
    trajectory: res.trajectory,
    guards: res.guards,
    startDate: res.startDate,
    targetDate: res.targetDate,
    startWeightKg: res.startWeightKg,
    targetWeightKg: res.targetWeightKg ?? null,
    identityFrame: res.identityFrame ?? null,
    mealsPerDay: planner?.mealsPerDay ?? res.mealsPerDay,
    wakeTime: planner?.wakeTime ?? res.wakeTime,
    bedTime: planner?.bedTime ?? res.bedTime,
  } satisfies GoalUpsertRequest
}

export const goalApi = {
  list: (): Promise<GoalResponse[]> => apiFetch<GoalResponse[]>('/api/goals'),
  get: (id: string): Promise<GoalResponse> => apiFetch<GoalResponse>(`/api/goals/${id}`),
  create: (body: GoalUpsertRequest): Promise<GoalResponse> =>
    apiFetch<GoalResponse>('/api/goals', { method: 'POST', body: JSON.stringify(body satisfies GoalUpsertRequest) }),
  update: (id: string, body: GoalUpsertRequest): Promise<GoalResponse> =>
    apiFetch<GoalResponse>(`/api/goals/${id}`, { method: 'PUT', body: JSON.stringify(body satisfies GoalUpsertRequest) }),
  remove: (id: string): Promise<void> => apiFetch<void>(`/api/goals/${id}`, { method: 'DELETE' }),
  activate: (id: string): Promise<GoalResponse> =>
    apiFetch<GoalResponse>(`/api/goals/${id}/activate`, { method: 'POST' }),
  archive: (id: string): Promise<GoalResponse> =>
    apiFetch<GoalResponse>(`/api/goals/${id}/archive`, { method: 'POST' }),
  // Run the TDEE/recept engine — computes + persists tdeeBootstrap + prescription,
  // returns the updated goal (G5). Surfaced via useGoalActions().evaluate.
  evaluate: (id: string): Promise<GoalResponse> =>
    apiFetch<GoalResponse>(`/api/goals/${id}/evaluate`, { method: 'POST' }),
  // Stateless realism preview (G6) — the backend derives the weekly %BW/wk pace
  // from a draft window + weights and returns a verdict (+ a cap-paced realistic
  // date when over the rate cap). No persistence, no ownership. Drives the cél
  // step's live feasibility panel (useFeasibilityPreview).
  feasibilityPreview: (body: FeasibilityPreviewRequest): Promise<FeasibilityPreviewResponse> =>
    apiFetch<FeasibilityPreviewResponse>('/api/goals/feasibility-preview', {
      method: 'POST',
      body: JSON.stringify(body satisfies FeasibilityPreviewRequest),
    }),
}
