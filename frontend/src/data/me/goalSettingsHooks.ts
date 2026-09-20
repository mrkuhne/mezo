import { goalOverviewSeed } from '@/data/me/goals'
import { localDateString } from '@/shared/lib/dates'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { goalApi, type GoalOverviewResponse, type GoalResponse, type GoalUpsertRequest, type FeasibilityPreviewRequest, type FeasibilityPreviewResponse } from '@/data/me/goalApi'

export function useGoalSettings(goal: GoalResponse, request: GoalUpsertRequest | null, remaining: FeasibilityPreviewRequest | null) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const stored = request ? { trajectory: request.trajectory, startWeightKg: request.startWeightKg, targetWeightKg: request.targetWeightKg, startDate: request.startDate, targetDate: request.targetDate } : null
  const preview = useDualQuery<FeasibilityPreviewResponse[] | null>({
    queryKey: ['goal-settings-preview', mock, stored, remaining],
    mockData: null,
    realEmpty: null,
    enabled: !!stored && !!remaining,
    realFetch: () => Promise.all([goalApi.feasibilityPreview(stored!), goalApi.feasibilityPreview(remaining!)]),
  })
  const mutation = useMutation({
    mutationFn: async (body: GoalUpsertRequest) => mock ? { ...goal, ...body } as GoalResponse : goalApi.update(goal.id, body),
    onSuccess: async updated => {
      if (mock) {
        qc.setQueryData<GoalResponse[]>(['goals'], old => (old ?? [goal]).map(g => g.id === goal.id ? updated : g))
        qc.setQueryData<GoalOverviewResponse>(['goal-overview', goal.id], previous => {
          const old = previous ?? goalOverviewSeed
          const distance = Math.abs(updated.startWeightKg - (updated.targetWeightKg ?? updated.startWeightKg))
          const remainingKg = Math.abs(old.currentWeightKg - (updated.targetWeightKg ?? old.currentWeightKg))
          const days = (Date.parse(updated.targetDate) - Date.parse(updated.startDate)) / 86400000
          const elapsed = (Date.parse(localDateString()) - Date.parse(updated.startDate)) / 86400000
          return {
            ...old, title: updated.title, trajectory: updated.trajectory, status: updated.status,
            targetWeightKg: updated.targetWeightKg, remainingKg,
            currentWeek: Math.max(1, Math.floor(elapsed / 7) + 1), totalWeeks: Math.max(1, Math.ceil(days / 7)),
            completionPct: distance > 0 ? Math.max(0, Math.min(100, (distance - remainingKg) / distance * 100)) : 0,
            // A mock write has no goal engine: do not keep the previous prescription or forecast.
            projectedTargetDate: null, targetRateKgPerWeek: null,
            courseStatus: 'learning', courseReasonCode: 'prescription_missing',
            diet: { todayDayType: 'unavailable', basis: 'unavailable', explanationCode: 'prescription_missing' },
            segment: { available: false, explanationCode: 'prescription_missing' },
            guards: { healthyCount: 0, totalCount: 0 },
            openSuggestionCount: 0, latestSuggestionId: null,
          }
        })
      }
      else await Promise.all([['goals'], ['goal-overview', goal.id], ['goal', goal.id], ['fuel'], ['companion-personal-context']].map(queryKey => qc.invalidateQueries({ queryKey })))
    },
  })
  return { preview: preview.data, previewPending: !mock && !!request && preview.isPending, previewError: preview.isError, retryPreview: preview.refetch, mock, save: mutation.mutateAsync, saving: mutation.isPending, error: mutation.error }
}
