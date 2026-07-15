import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { Challenge, ChallengeStatus, ChallengeType } from '@/data/types'

type ChallengeWire =
  paths['/api/proactive/challenge']['get']['responses']['200']['content']['application/json'][number]
type DecisionRequest =
  paths['/api/proactive/challenge/{id}/decision']['post']['requestBody']['content']['application/json']

/** Wire → FE Challenge: confidence null preserved (→ "tanulom"); tools omitted (live sends none). */
export function toChallenge(w: ChallengeWire): Challenge {
  return {
    id: w.id,
    type: w.type as ChallengeType,
    typeLabel: w.typeLabel,
    exerciseId: w.exerciseId,
    exercise: w.exercise,
    target: w.target,
    confidence: w.confidence ?? null,
    risk: w.risk as 'low' | 'mid',
    why: w.why,
    refs: w.refs,
    glory: w.glory,
    status: w.status as ChallengeStatus,
    outcome: w.outcome ?? undefined,
    outcomeGood: w.outcomeGood ?? undefined,
    targetWeightKg: w.targetWeightKg ?? null,
    targetReps: w.targetReps ?? null,
    targetSets: w.targetSets ?? null,
    targetRir: w.targetRir ?? null,
    // no tools in live — omitted
  }
}

export const challengeApi = {
  list: (templateSessionId: string, date: string) =>
    apiFetch<ChallengeWire[]>(
      `/api/proactive/challenge?templateSessionId=${templateSessionId}&date=${date}`,
    ).then((rows) => rows.map(toChallenge)),
  decide: (id: string, decision: 'accept' | 'dismiss') =>
    apiFetch<ChallengeWire>(`/api/proactive/challenge/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision } satisfies DecisionRequest),
    }).then(toChallenge),
}
