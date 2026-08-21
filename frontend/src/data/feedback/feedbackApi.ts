import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type {
  ArtifactFeedback,
  FeedbackArtifactKind,
  FeedbackReason,
  FeedbackVerdict,
} from '@/data/feedback/feedbackTypes'

type FeedbackListResponse = paths['/api/companion/feedback']['get']['responses']['200']['content']['application/json']
type FeedbackWire = FeedbackListResponse[number]
type PutFeedbackBody = paths['/api/companion/feedback']['put']['requestBody']['content']['application/json']

/** The contract caps the batch read at 200 ids (`maxItems`); a longer list is a 400. */
export const FEEDBACK_MAX_IDS = 200

/** The wire spells the three enums as plain `string` (openapi-typescript can't narrow the
 * doc-commented unions), so the narrowing happens here — at the boundary, once. */
export function toArtifactFeedback(w: FeedbackWire): ArtifactFeedback {
  return {
    artifactKind: w.artifactKind as FeedbackArtifactKind,
    artifactId: w.artifactId,
    verdict: w.verdict as FeedbackVerdict,
    reason: (w.reason ?? null) as FeedbackReason | null,
    updatedAt: w.updatedAt,
  }
}

export const feedbackApi = {
  /** Batch page-hydration read. `ids` is comma-joined (OpenAPI `style: form, explode: false`);
   * ids that carry no verdict are simply absent from the response. */
  list: (kind: FeedbackArtifactKind, ids: string[]): Promise<ArtifactFeedback[]> =>
    apiFetch<FeedbackListResponse>(
      `/api/companion/feedback?kind=${kind}&ids=${ids.map(encodeURIComponent).join(',')}`,
    ).then((rows) => rows.map(toArtifactFeedback)),

  /** Upsert the single verdict for one artifact. A `reason` is only legal with `down` — the
   * caller passes `undefined` for `up` (sending one there is a 400). */
  put: (
    kind: FeedbackArtifactKind,
    artifactId: string,
    verdict: FeedbackVerdict,
    reason?: FeedbackReason,
  ): Promise<ArtifactFeedback> =>
    apiFetch<FeedbackWire>('/api/companion/feedback', {
      method: 'PUT',
      body: JSON.stringify({ artifactKind: kind, artifactId, verdict, reason } satisfies PutFeedbackBody),
    }).then(toArtifactFeedback),

  /** Retract — idempotent (retracting a never-voted artifact also answers 204). */
  remove: (kind: FeedbackArtifactKind, artifactId: string): Promise<void> =>
    apiFetch<void>(`/api/companion/feedback/${kind}/${encodeURIComponent(artifactId)}`, { method: 'DELETE' }),
}
