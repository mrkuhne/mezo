import { useDualQuery } from '@/data/useDualQuery'
import { expenditureApi, type ExpenditureExplanation } from '@/data/fuel/expenditureApi'
import { expenditureExplanationSeed } from '@/data/fuel/expenditureExplanation'

export const EXPENDITURE_EXPLANATION_KEY = ['expenditureExplanation'] as const

/**
 * „Hogy tanultam?” (mezo-y72o3): the learned base's persisted explanation. Mock seeds the
 * prototype fixture; real fetches `GET /api/goals/expenditure/explanation` only while `enabled`
 * (the explainer opens lazily). `data === null` + `!isPending` = no explained week yet (204).
 */
export function useExpenditureExplanation(enabled: boolean): {
  data: ExpenditureExplanation | null
  isPending: boolean
  isError: boolean
} {
  const { data, isPending, isError } = useDualQuery<ExpenditureExplanation | null>({
    queryKey: EXPENDITURE_EXPLANATION_KEY,
    mockData: expenditureExplanationSeed,
    realFetch: expenditureApi.explanation,
    realEmpty: null,
    enabled,
  })
  return { data, isPending: data === null && isPending, isError }
}
