/** One recorded decision with its review loop (Journal W1.4, mezo-b3pp.4). The server-frozen
 * context snapshot deliberately never crosses the wire — it exists for the companion's recall,
 * not for display. */
export interface DecisionEntry {
  id: string
  decidedOn: string
  decisionText: string
  /** decidedOn + the backend's decision-review-days; server-computed, never derived here. */
  reviewDue: string
  reviewedAt: string | null
  outcomeRating: number | null
  outcomeText: string | null
  createdAt: string
}
