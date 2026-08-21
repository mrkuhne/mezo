import { useCallback, useMemo } from 'react'
import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { FEEDBACK_MAX_IDS, feedbackApi } from '@/data/feedback/feedbackApi'
import { mockFeedback } from '@/data/feedback/feedbackMock'
import type {
  ArtifactFeedback,
  FeedbackArtifactKind,
  FeedbackHandle,
  FeedbackReason,
  FeedbackVerdict,
} from '@/data/feedback/feedbackTypes'

/** Referentially stable honest-empty for the real-mode unresolved window (never the seed). */
const EMPTY: ArtifactFeedback[] = []

type VoteOp =
  | { op: 'upsert'; artifactId: string; verdict: FeedbackVerdict; reason?: FeedbackReason }
  | { op: 'retract'; artifactId: string }

/** Every currently-cached feedback list for this kind. Real mode keys by the rendered id set, so
 * the SAME artifact can sit in several cache entries at once (chat page + feed page): a write has
 * to land in all of them or one surface would keep showing the stale chip. */
function feedbackQueryKeys(qc: QueryClient, kind: FeedbackArtifactKind): QueryKey[] {
  return qc
    .getQueryCache()
    .findAll({ queryKey: ['feedback', kind] })
    .map((q) => q.queryKey)
}

function writeRow(
  qc: QueryClient,
  kind: FeedbackArtifactKind,
  artifactId: string,
  next: ArtifactFeedback | null,
): void {
  for (const queryKey of feedbackQueryKeys(qc, kind)) {
    qc.setQueryData<ArtifactFeedback[]>(queryKey, (rows) => {
      const without = (rows ?? []).filter((r) => r.artifactId !== artifactId)
      return next ? [...without, next] : without
    })
  }
}

/**
 * 👍/👎 feedback for one page (mezo-b3pp.15).
 *
 * Call it ONCE PER PAGE with every artifact id that page renders — never once per card: a
 * per-card hook would fire one HTTP request per card (20+ on the chat screen). The returned
 * handle keeps the cards dumb — they read `get(id)` and call `vote(id, verdict[, reason])`.
 *
 * Toggle semantics live HERE, not in the UI: `vote` retracts (DELETE) when the tapped verdict is
 * already the stored one and no NEW reason came with the tap, and upserts (PUT) otherwise — so
 * a bare chip re-tap clears the verdict while picking a different reason updates the reason.
 *
 * Modes:
 * - **mock:** the seed is honestly empty; votes are written into the query cache and accumulate
 *   for the session. The cache key omits the id set there (mock never fetches, so the ids play no
 *   part in cache identity) — otherwise a newly-arrived chat message would change the key and
 *   silently drop every vote the demo user had just cast.
 * - **real:** one batch GET per rendered id set, an optimistic cache write on every vote, then an
 *   invalidate so server truth wins. A FAILED read degrades to "no verdicts" (IDENT-3) — a
 *   missing verdict never breaks the page it decorates.
 */
export function useFeedback(kind: FeedbackArtifactKind, ids: string[]): FeedbackHandle {
  const qc = useQueryClient()
  const mock = isMockMode()

  // Dedupe (the same artifact can legitimately be rendered twice) and cap at the contract's
  // maxItems — an oversized list is a guaranteed 400, i.e. NO verdicts for the whole page.
  const requestIds = useMemo(() => [...new Set(ids)].slice(0, FEEDBACK_MAX_IDS), [ids])
  const fingerprint = useMemo(() => [...requestIds].sort().join(','), [requestIds])
  const queryKey = useMemo(
    () => (mock ? ['feedback', kind] : ['feedback', kind, fingerprint]),
    [mock, kind, fingerprint],
  )

  const { data } = useDualQuery<ArtifactFeedback[]>({
    queryKey,
    mockData: mockFeedback,
    // No `enabled` option on useDualQuery (by design — it always resolves to a value). An empty
    // id set therefore skips the network here: the contract requires minItems: 1, so a request
    // would be a guaranteed 400.
    realFetch: async () => (requestIds.length ? feedbackApi.list(kind, requestIds) : EMPTY),
    realEmpty: EMPTY,
  })

  const byId = useMemo(() => new Map(data.map((r) => [r.artifactId, r])), [data])

  const mutation = useMutation({
    mutationFn: async (v: VoteOp): Promise<void> => {
      if (mock) return // onMutate already wrote the cache — mock mode never reaches the network
      if (v.op === 'retract') return feedbackApi.remove(kind, v.artifactId)
      await feedbackApi.put(kind, v.artifactId, v.verdict, v.reason)
    },
    onMutate: async (v: VoteOp) => {
      // Stop an in-flight batch read from resolving on top of the optimistic write.
      await qc.cancelQueries({ queryKey: ['feedback', kind] })
      const previous = feedbackQueryKeys(qc, kind).map(
        (key) => [key, qc.getQueryData<ArtifactFeedback[]>(key)] as const,
      )
      writeRow(
        qc,
        kind,
        v.artifactId,
        v.op === 'retract'
          ? null
          : {
              artifactKind: kind,
              artifactId: v.artifactId,
              verdict: v.verdict,
              reason: v.reason ?? null,
              updatedAt: new Date().toISOString(),
            },
      )
      return { previous }
    },
    onError: (_err, _v, context) => {
      // A rejected write must not leave a lie on screen — put the pre-vote rows back.
      for (const [key, rows] of context?.previous ?? []) qc.setQueryData(key, rows)
    },
    onSettled: () => {
      // Mock mode must NOT invalidate: its queryFn re-serves the (empty) seed, which would wipe
      // the session's votes. Real mode refetches so server truth replaces the optimistic row.
      if (!mock) void qc.invalidateQueries({ queryKey: ['feedback', kind] })
    },
  })

  const get = useCallback((artifactId: string) => byId.get(artifactId), [byId])

  const { mutate } = mutation
  const vote = useCallback(
    (artifactId: string, verdict: FeedbackVerdict, reason?: FeedbackReason): void => {
      // Read through the cache, not `byId`: a vote fired from a stale render (two taps in one
      // frame) must still see the verdict the previous tap just wrote.
      const current =
        qc.getQueryData<ArtifactFeedback[]>(queryKey)?.find((r) => r.artifactId === artifactId) ??
        byId.get(artifactId)
      // The reason is only legal on `down` — the backend 400s a reason sent with `up`.
      const nextReason = verdict === 'down' ? reason : undefined
      const sameVerdict = current?.verdict === verdict
      const noNewReason = nextReason === undefined || nextReason === current?.reason
      if (sameVerdict && noNewReason) {
        mutate({ op: 'retract', artifactId })
        return
      }
      mutate({ op: 'upsert', artifactId, verdict, reason: nextReason })
    },
    [qc, queryKey, byId, mutate],
  )

  return { get, vote, pending: mutation.isPending }
}
