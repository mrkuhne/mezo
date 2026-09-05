/** 👍/👎 feedback on an AI-produced artifact (CompanionFeedback, mezo-b3pp.15).
 *
 * The seven kinds span seven different backend tables — one verdict per
 * (user, artifactKind, artifactId), overwritten by a new verdict and removed by a retraction.
 * `day_review` (mezo-jcpt.9) is the day page's analogue of `weekly_review`: it targets the
 * evaluation's own `reviewId`, present only when the scored day actually has LLM prose. */
export type FeedbackArtifactKind =
  | 'chat_message'
  | 'feed_message'
  | 'weekly_suggestion'
  | 'memoir'
  | 'prediction'
  | 'weekly_review'
  | 'day_review'

export type FeedbackVerdict = 'up' | 'down'

/** Down-verdicts only — the backend rejects a reason sent with `up` (400). */
export type FeedbackReason = 'inaccurate' | 'too_much' | 'bad_timing' | 'not_about_me'

export interface ArtifactFeedback {
  artifactKind: FeedbackArtifactKind
  artifactId: string
  verdict: FeedbackVerdict
  reason: FeedbackReason | null
  updatedAt: string
}

/**
 * What `useFeedback(kind, ids)` hands a screen. The hook is called ONCE PER PAGE with every
 * artifact id that page renders (never once per card — that would be one HTTP request per card),
 * so the cards themselves stay dumb: they read `get(id)` and call `vote(id, verdict)`.
 *
 * `vote` owns the toggle semantics: re-tapping the verdict that is already set retracts it.
 */
export interface FeedbackHandle {
  /** The stored verdict for this artifact, or `undefined` when it carries none. */
  get: (artifactId: string) => ArtifactFeedback | undefined
  /** Upsert — or, when `verdict` is already the stored one and no NEW reason is given, retract. */
  vote: (artifactId: string, verdict: FeedbackVerdict, reason?: FeedbackReason) => void
  /** A write is in flight (the read is deliberately not surfaced — a missing verdict is not an error). */
  pending: boolean
}
