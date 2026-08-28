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

/**
 * Ids per HTTP request. This is a HEADER-BUDGET number, not a contract number (the contract's
 * `maxItems` is 200 and every chunk stays well under it): a uuid costs ~37 chars comma-joined, so
 * 100 ids is a ~3.7 KB query string, leaving room for `Authorization: Bearer …` and the browser's
 * own headers inside Tomcat's default 8 KB `server.max-http-request-header-size` (mezo-b3pp.23).
 * At the old 200 the request line alone was ~7.45 KB, Tomcat answered a bare 400 with no
 * `SystemMessageList` body, and the page's every chip silently read unvoted.
 */
export const FEEDBACK_IDS_PER_REQUEST = 100

/**
 * Overall ceiling for one page's hydration read — at most ten requests. Chunking removed the
 * header wall, so this is purely about not fanning out unboundedly on a very long conversation
 * (`CompanionController.listMessages` returns the WHOLE conversation, unwindowed). Past this the
 * oldest ids are dropped, which is the same quiet truncation the old 200 had — just an order of
 * magnitude further out. The real cure is windowing the message read upstream.
 */
export const FEEDBACK_MAX_IDS = 1000

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
  /** Batch page-hydration read, chunked (mezo-b3pp.23). `ids` is comma-joined per chunk (OpenAPI
   * `style: form, explode: false`); ids that carry no verdict are simply absent from the response.
   * The chunks are merged here so the CALLER still sees one list and `useFeedback` still runs one
   * query with one cache key — chunking in the api layer is what keeps the hook's cache machinery
   * untouched. One failing chunk rejects the whole call on purpose: a partially merged answer
   * would render some chips unvoted with no signal at all. */
  list: async (kind: FeedbackArtifactKind, ids: string[]): Promise<ArtifactFeedback[]> => {
    if (ids.length === 0) {
      return []
    }
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += FEEDBACK_IDS_PER_REQUEST) {
      chunks.push(ids.slice(i, i + FEEDBACK_IDS_PER_REQUEST))
    }
    const pages = await Promise.all(
      chunks.map((chunk) =>
        apiFetch<FeedbackListResponse>(
          `/api/companion/feedback?kind=${kind}&ids=${chunk.map(encodeURIComponent).join(',')}`,
        ),
      ),
    )
    return pages.flat().map(toArtifactFeedback)
  },

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
