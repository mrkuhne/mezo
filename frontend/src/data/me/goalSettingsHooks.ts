import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { goalApi, type GoalResponse, type GoalUpsertRequest, type FeasibilityPreviewRequest, type FeasibilityPreviewResponse } from '@/data/me/goalApi'

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
      if (mock) qc.setQueryData<GoalResponse[]>(['goals'], old => (old ?? [goal]).map(g => g.id === goal.id ? updated : g))
      else await Promise.all([['goals'], ['goal-overview', goal.id], ['goal', goal.id], ['fuel'], ['companion-personal-context']].map(queryKey => qc.invalidateQueries({ queryKey })))
    },
  })
  return { preview: preview.data, previewPending: !mock && !!request && preview.isPending, previewError: preview.isError, retryPreview: preview.refetch, mock, save: mutation.mutateAsync, saving: mutation.isPending, error: mutation.error }
}
