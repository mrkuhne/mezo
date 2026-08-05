import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { slotTemplateApi, type SlotPlanEvaluateInput, type SlotPlanVerdict } from '@/data/fuel/slotTemplateApi'
import type { SlotTemplate, SlotTemplateDayType } from '@/data/types'

/** Exported for timelineHooks-adjacent invalidation if a sibling module needs to touch this cache. */
export const SLOT_TEMPLATES_KEY = ['fuelSlotTemplates'] as const

const MOCK_SLOT_PLAN_VERDICT: SlotPlanVerdict = {
  verdict: 'ok',
  summary: 'A felosztás illik a célodhoz — a fehérje-elosztás és az edzés körüli időzítés rendben van.',
  suggestions: [],
}

export function useSlotTemplates() {
  const { data, isPending } = useDualQuery<SlotTemplate[]>({
    queryKey: SLOT_TEMPLATES_KEY,
    mockData: [],
    realFetch: slotTemplateApi.list,
    realEmpty: [],
  })
  return { templates: data, isPending }
}

export function useSlotTemplateActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const putM = useMutation({
    mutationFn: async (t: SlotTemplate) => {
      if (mock) {
        mockPut(qc, t)
        return
      }
      await slotTemplateApi.put(t)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: SLOT_TEMPLATES_KEY }),
  })
  const deleteM = useMutation({
    mutationFn: async (dayType: SlotTemplateDayType) => {
      if (mock) {
        mockDelete(qc, dayType)
        return
      }
      await slotTemplateApi.remove(dayType)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: SLOT_TEMPLATES_KEY }),
  })

  return {
    putTemplate: (t: SlotTemplate) => putM.mutateAsync(t).then(() => undefined),
    deleteTemplate: (dayType: SlotTemplateDayType) => deleteM.mutateAsync(dayType).then(() => undefined),
    pending: putM.isPending || deleteM.isPending,
  }
}

/** Mezo's qualitative read on a custom slot split (mezo-7102 Task 12) — an evaluate-on-demand
 *  call, stateless: no cache entry, no invalidation, nothing else in the app depends on the
 *  result. Mock mode serves a canned verdict after a demo delay; real mode POSTs the flattened
 *  draft plan (the caller's current, possibly unsaved, rows) to the backend companion. */
export function useSlotTemplateEvaluation() {
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: (input: SlotPlanEvaluateInput): Promise<SlotPlanVerdict> =>
      mock
        ? new Promise(resolve => setTimeout(() => resolve(MOCK_SLOT_PLAN_VERDICT), 400))
        : slotTemplateApi.evaluate(input),
  })
  return {
    evaluate: (input: SlotPlanEvaluateInput) => mutation.mutateAsync(input),
    pending: mutation.isPending,
  }
}

// --- mock-mode cache mutators: keep the offline app interactive (pantryHooks upsert/delete form) ---
function mockPut(qc: ReturnType<typeof useQueryClient>, t: SlotTemplate) {
  qc.setQueryData<SlotTemplate[]>(SLOT_TEMPLATES_KEY, prev => {
    const base = prev ?? []
    const idx = base.findIndex(x => x.dayType === t.dayType)
    if (idx === -1) return [...base, t]
    return base.map((x, i) => (i === idx ? t : x))
  })
  return undefined
}
function mockDelete(qc: ReturnType<typeof useQueryClient>, dayType: SlotTemplateDayType) {
  qc.setQueryData<SlotTemplate[]>(SLOT_TEMPLATES_KEY, prev => {
    const base = prev ?? []
    return base.filter(x => x.dayType !== dayType)
  })
  return undefined
}
