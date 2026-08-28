// Weekly review (mezo-p2tr) — the live-only wire calls behind useWeeklyReview. GET 404s when
// the week has no persisted review yet (the WeeklyReviewJob owns generation, never a lazy GET);
// the digest is always 200 (an honest-empty week-window read, independent of the review row).
import { apiFetch } from '@/data/_client/api'
import type { WeeklyReview, WeeklyReviewDigest } from '@/data/me/weeklyReviewMock'

export const weeklyReviewApi = {
  /** `startIso` must be the ISO Monday of the wanted week — the backend 400s otherwise. */
  get: (startIso: string): Promise<WeeklyReview> =>
    apiFetch<WeeklyReview>(`/api/proactive/weekly-review/${startIso}`),

  /** On-demand regeneration (409 while the week is still in progress, 404 on an empty week). */
  regenerate: (startIso: string): Promise<WeeklyReview> =>
    apiFetch<WeeklyReview>(`/api/proactive/weekly-review/${startIso}/regenerate`, { method: 'POST' }),

  digest: (startIso: string): Promise<WeeklyReviewDigest> =>
    apiFetch<WeeklyReviewDigest>(`/api/proactive/weekly-review/${startIso}/digest`),
}
