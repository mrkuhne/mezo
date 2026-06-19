import { apiFetch } from './api'
import type { components } from './api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type GoalResponse = components['schemas']['GoalResponse']
export type GoalUpsertRequest = components['schemas']['GoalUpsertRequest']

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
}
