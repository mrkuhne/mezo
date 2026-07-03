import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { Pattern, PatternCategory, PatternRowStatus, PatternStatus } from '@/data/types'

export type PatternResponse = components['schemas']['PatternResponse']
export type PatternDecisionRequest = components['schemas']['PatternDecisionRequest']

const PATTERN = '/api/companion/pattern'

/** Wire → FE domain: nullable confidence/critique stay absent (statistical rows — V3.1). */
export function toPattern(w: PatternResponse): Pattern {
  return {
    id: w.id,
    // wire strings come from our own backend CHECK constraints
    category: w.category as PatternCategory,
    categoryLabel: w.categoryLabel,
    confidence: w.confidence ?? undefined,
    title: w.title,
    mechanism: w.mechanism ?? '',
    evidence: w.evidence,
    critique:
      w.critique?.statistical != null
        ? {
            statistical: w.critique.statistical,
            confounders: w.critique.confounders ?? 0,
            l3align: w.critique.l3align ?? 0,
            actionability: w.critique.actionability ?? 0,
          }
        : undefined,
    status: w.status as PatternRowStatus,
    kind: w.kind as Pattern['kind'],
  }
}

export const patternsApi = {
  list: async () => (await apiFetch<PatternResponse[]>(PATTERN)).map(toPattern),
  decide: (id: string, decision: PatternStatus) =>
    apiFetch<PatternResponse>(`${PATTERN}/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision } satisfies PatternDecisionRequest),
    }),
}
