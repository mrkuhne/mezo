import { apiFetch } from './api'
import type { components } from './api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type GoalTimelineResponse = components['schemas']['GoalTimelineResponse']
export type GoalPlanLinkResponse = components['schemas']['GoalPlanLinkResponse']
export type GoalPlanAttachRequest = components['schemas']['GoalPlanAttachRequest']

export const goalLinkApi = {
  timeline: (goalId: string): Promise<GoalTimelineResponse> =>
    apiFetch<GoalTimelineResponse>(`/api/goals/${goalId}/timeline`),
  attach: (goalId: string, body: GoalPlanAttachRequest): Promise<GoalPlanLinkResponse> =>
    apiFetch<GoalPlanLinkResponse>(`/api/goals/${goalId}/plans`, { method: 'POST', body: JSON.stringify(body satisfies GoalPlanAttachRequest) }),
  detach: (goalId: string, linkId: string): Promise<void> =>
    apiFetch<void>(`/api/goals/${goalId}/plans/${linkId}`, { method: 'DELETE' }),
}
