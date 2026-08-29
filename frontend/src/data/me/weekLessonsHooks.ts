// ============================================================
// Mezo · useWeekLessons — dual-mode read of the week's knowledge candidates
// (mezo-d20.6.10). MOCK: the prototype's three open candidates, re-dated per
// startIso (the weeklyReviewMock idiom). REAL: `GET /api/proactive/weekly-
// review/{start}/lessons`, which F6.5 has NOT shipped yet — a 404 is therefore
// the expected, honest "no weekly candidates for this week" answer, mapped to []
// exactly like useWeeklyReview maps the review GET's 404 to `review: null`.
// When the backend slice lands, this hook starts returning rows with NO change
// here and none on the page.
//
// isPending / isError are surfaced deliberately (handoff §4, the "ma egyik sincs"
// row): the page owes a skeleton and a retryable error, not a fabricated empty.
// ============================================================
import { ApiError, apiFetch } from '@/data/_client/api'
import { useDualQuery } from '@/data/useDualQuery'
import { mockWeekLessons, toWeekLesson, type WeekLesson, type WeekLessonWire } from '@/data/me/weekLessons'

export type { WeekLesson }

const EMPTY: WeekLesson[] = []

export const weekLessonsApi = {
  /** `startIso` must be an ISO Monday — the backend 400s otherwise (the weekly-review idiom). */
  list: async (startIso: string): Promise<WeekLesson[]> => {
    const rows = await apiFetch<WeekLessonWire[]>(`/api/proactive/weekly-review/${startIso}/lessons`)
    return rows.map(toWeekLesson)
  },
}

export interface WeekLessonsBootstrap {
  lessons: WeekLesson[]
  isPending: boolean
  isError: boolean
  refetch: () => void
}

export function useWeekLessons(startIso: string): WeekLessonsBootstrap {
  const { data, isPending, isError, refetch } = useDualQuery<WeekLesson[]>({
    queryKey: ['weekLessons', startIso],
    mockData: mockWeekLessons(startIso),
    realFetch: async () => {
      try {
        return await weekLessonsApi.list(startIso)
      } catch (e) {
        // 404 = this week has no candidate row (and, until F6.5, the route itself does not
        // exist). Both mean the same honest thing to the reader: nothing was proposed.
        if (e instanceof ApiError && e.status === 404) return EMPTY
        throw e
      }
    },
    realEmpty: EMPTY,
  })
  return { lessons: data, isPending, isError, refetch }
}
