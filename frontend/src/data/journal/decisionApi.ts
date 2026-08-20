import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { DecisionEntry } from '@/data/journal/decisionTypes'

type DecisionListResponse = paths['/api/journal/decision']['get']['responses']['200']['content']['application/json']
type DecisionWire = DecisionListResponse[number]
type DecisionCreateBody = paths['/api/journal/decision']['post']['requestBody']['content']['application/json']
type DecisionReviewBody =
  paths['/api/journal/decision/{id}/review']['put']['requestBody']['content']['application/json']

export function toDecisionEntry(w: DecisionWire): DecisionEntry {
  return {
    id: w.id,
    decidedOn: w.decidedOn,
    decisionText: w.decisionText,
    reviewDue: w.reviewDue,
    reviewedAt: w.reviewedAt ?? null,
    outcomeRating: w.outcomeRating ?? null,
    outcomeText: w.outcomeText ?? null,
    createdAt: w.createdAt,
  }
}

export const decisionApi = {
  list: (): Promise<DecisionEntry[]> =>
    apiFetch<DecisionListResponse>('/api/journal/decision').then((rows) => rows.map(toDecisionEntry)),
  create: (decisionText: string, decidedOn?: string): Promise<DecisionEntry> =>
    apiFetch<DecisionWire>('/api/journal/decision', {
      method: 'POST',
      body: JSON.stringify({ decisionText, decidedOn } satisfies DecisionCreateBody),
    }).then(toDecisionEntry),
  review: (id: string, outcomeRating: number, outcomeText?: string): Promise<DecisionEntry> =>
    apiFetch<DecisionWire>(`/api/journal/decision/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ outcomeRating, outcomeText } satisfies DecisionReviewBody),
    }).then(toDecisionEntry),
}
