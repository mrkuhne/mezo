import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { slotTemplateApi } from '@/data/fuel/slotTemplateApi'
import type { SlotTemplate, SlotTemplateDayType } from '@/data/types'

/** Exported for timelineHooks-adjacent invalidation if a sibling module needs to touch this cache. */
export const SLOT_TEMPLATES_KEY = ['fuelSlotTemplates'] as const

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
