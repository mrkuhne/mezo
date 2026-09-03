import { apiFetch } from '@/data/_client/api'
import type { DayEvaluationResponse } from '@/data/me/dayEvaluation'

export const dayEvaluationApi = {
  /** `dateIso` must be a real calendar date — the backend 400s otherwise
   *  (`GET /api/me/day/{date}/evaluation`). */
  get: (dateIso: string) => apiFetch<DayEvaluationResponse>(`/api/me/day/${dateIso}/evaluation`),
}
