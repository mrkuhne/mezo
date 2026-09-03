// ============================================================
// Mezo · lifegoalApi — REST client for the life-goal slice (mezo-iizd.1).
// ============================================================
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

export type LifeGoalResponse = components['schemas']['LifeGoalResponse']
export type LifeGoalUpsertRequest = components['schemas']['LifeGoalUpsertRequest']
export type LifeGoalPillarInput = components['schemas']['LifeGoalPillarInput']
export type LifeGoalPillarResponse = components['schemas']['LifeGoalPillarResponse']
export type LifeGoalStatus = components['schemas']['LifeGoalStatus']
export type LifeGoalDimension = components['schemas']['LifeGoalDimension']
export type LifeGoalFrame = components['schemas']['LifeGoalFrame']
export type PillarKind = components['schemas']['PillarKind']
export type PillarSource = components['schemas']['PillarSource']
export type PillarRule = components['schemas']['PillarRule']
export type IfThenPlan = components['schemas']['IfThenPlan']
export type LifeGoalProposeRequest = components['schemas']['LifeGoalProposeRequest']
export type LifeGoalProposeResponse = components['schemas']['LifeGoalProposeResponse']
export type SignalCatalogEntry = components['schemas']['SignalCatalogEntry']
type SignalCatalogResponse = components['schemas']['SignalCatalogResponse']
export type LifeGoalProgressResponse = components['schemas']['LifeGoalProgressResponse']
export type LifeGoalTodayResponse = components['schemas']['LifeGoalTodayResponse']
export type PillarProgress = components['schemas']['PillarProgress']
export type PillarDayStatus = components['schemas']['PillarDayStatus']
export type TrendArrow = components['schemas']['TrendArrow']

const json = (body: unknown) => JSON.stringify(body)

export const lifegoalApi = {
  list: () => apiFetch<LifeGoalResponse[]>('/api/life-goals'),
  get: (id: string) => apiFetch<LifeGoalResponse>(`/api/life-goals/${id}`),
  create: (body: LifeGoalUpsertRequest) =>
    apiFetch<LifeGoalResponse>('/api/life-goals', { method: 'POST', body: json(body) }),
  update: (id: string, body: LifeGoalUpsertRequest) =>
    apiFetch<LifeGoalResponse>(`/api/life-goals/${id}`, { method: 'PUT', body: json(body) }),
  remove: (id: string) => apiFetch<void>(`/api/life-goals/${id}`, { method: 'DELETE' }),
  changeStatus: (id: string, status: LifeGoalStatus) =>
    apiFetch<LifeGoalResponse>(`/api/life-goals/${id}/status`, { method: 'POST', body: json({ status }) }),
  replacePillars: (id: string, pillars: LifeGoalPillarInput[]) =>
    apiFetch<LifeGoalResponse>(`/api/life-goals/${id}/pillars`, { method: 'PUT', body: json({ pillars }) }),
  propose: (body: LifeGoalProposeRequest) =>
    apiFetch<LifeGoalProposeResponse>('/api/life-goals/propose', { method: 'POST', body: json(body) }),
  signals: () => apiFetch<SignalCatalogResponse>('/api/life-goals/signals'),
  progress: (id: string, from: string, to: string) =>
    apiFetch<LifeGoalProgressResponse>(`/api/life-goals/${id}/progress?from=${from}&to=${to}`),
  today: () => apiFetch<LifeGoalTodayResponse>('/api/life-goals/today'),
  evaluate: (id: string) =>
    apiFetch<LifeGoalProgressResponse>(`/api/life-goals/${id}/evaluate`, { method: 'POST' }),
}
