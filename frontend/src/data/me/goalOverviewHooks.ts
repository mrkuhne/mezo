import { goalApi, type GoalOverviewResponse } from '@/data/me/goalApi'
import { goalOverviewSeed } from '@/data/me/goals'
import { useDualQuery } from '@/data/useDualQuery'

const EMPTY_GOAL_OVERVIEW: GoalOverviewResponse = {
  goalId: '',
  title: '',
  trajectory: 'maintain',
  status: 'active',
  currentWeek: 1,
  totalWeeks: 1,
  completionPct: 0,
  currentWeightKg: 0,
  courseStatus: 'learning',
  courseReasonCode: 'trend_missing',
  dataSufficiency: 'none',
  diet: {
    todayDayType: 'unavailable',
    basis: 'unavailable',
    explanationCode: 'prescription_missing',
  },
  segment: {
    available: false,
    explanationCode: 'prescription_missing',
  },
  plans: {
    links: [],
    gaps: [],
    sportSchedule: [],
    activeLinkCount: 0,
    uncoveredWeekCount: 0,
  },
  guards: {
    healthyCount: 0,
    totalCount: 0,
  },
  openSuggestionCount: 0,
}

export function useGoalOverview(goalId: string | null) {
  const { data, isPending } = useDualQuery<GoalOverviewResponse>({
    queryKey: ['goal-overview', goalId],
    enabled: goalId !== null,
    mockData: goalOverviewSeed,
    realFetch: () => goalApi.overview(goalId as string),
    realEmpty: EMPTY_GOAL_OVERVIEW,
  })
  return {
    overview: goalId ? data : null,
    pending: goalId !== null && isPending,
  }
}
