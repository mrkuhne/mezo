import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { ClayIconName } from '@/shared/ui/clay'
import type {
  Observation,
  ObservationCardKind,
  ObservationChoice,
  PatternRowStatus,
} from '@/data/types'

export type ObservationResponse = components['schemas']['ObservationResponse']
export type PatternReplyRequest = components['schemas']['PatternReplyRequest']
export type PatternReplyResponse = components['schemas']['PatternReplyResponse']

const OBSERVATION = '/api/companion/observation'
const PATTERN = '/api/companion/pattern'

/**
 * `ObservationResponse.sourceIcon` → the clay sprite name (Reflexió S5, mezo-eq85.5).
 * The wire values are the backend's own six bare surface names; the clay set is `i-` prefixed.
 * There is no shared domain→icon map in the FE to reuse, so this explicit table IS the map.
 * `hold` has no v1 producer on the backend yet — mapped anyway, the seed exercises it.
 */
const SOURCE_ICONS: Record<string, ClayIconName> = {
  naplo: 'i-naplo',
  alvas: 'i-alvas',
  edzes: 'i-edzes',
  vacsora: 'i-vacsora',
  hold: 'i-hold',
  mezo: 'i-mezo',
}

/** Wire → FE domain. Nullable wire fields become ABSENT, never `null`, per the FE types. */
export function toObservation(w: ObservationResponse): Observation {
  return {
    id: w.id,
    patternId: w.patternId,
    hypothesisKey: w.hypothesisKey ?? undefined,
    // wire strings come from our own backend CHECK constraints
    card: w.card as ObservationCardKind,
    occurredAt: w.occurredAt,
    title: w.title,
    text: w.text,
    question: w.question ?? undefined,
    evidence: w.evidence,
    status: w.status as PatternRowStatus,
    evidenceHits: w.evidenceHits,
    evidenceMisses: w.evidenceMisses,
    minN: w.minN ?? undefined,
    belief: w.belief ?? undefined,
    repliedChoice: (w.repliedChoice as ObservationChoice | null) ?? undefined,
    // An unknown/newer surface name must not blank the card's clay disc — fall back to the Mezo mark.
    sourceIcon: SOURCE_ICONS[w.sourceIcon] ?? 'i-mezo',
  }
}

export const observationsApi = {
  /** The server already orders the feed (fresh → return → watching → confirmed, newest first
   *  inside a group) — never re-sort it here. */
  list: async (date?: string) =>
    (await apiFetch<ObservationResponse[]>(
      date ? `${OBSERVATION}?date=${encodeURIComponent(date)}` : OBSERVATION,
    )).map(toObservation),
  reply: (patternId: string, choice: ObservationChoice, text?: string) =>
    apiFetch<PatternReplyResponse>(`${PATTERN}/${patternId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ choice, ...(text ? { text } : null) } satisfies PatternReplyRequest),
    }),
}
