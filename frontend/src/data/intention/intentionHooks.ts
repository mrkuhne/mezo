import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import { intentionApi } from '@/data/intention/intentionApi'
import { mockIntentionDay } from '@/data/intention/intentionMock'
import type { IntentionDay, Reflection } from '@/data/types'
import { useDualQuery } from '@/data/useDualQuery'

const key = (d: string) => ['intentionDay', d]
const EMPTY = (date: string): IntentionDay => ({ date, creed: null, foci: [], reflection: null, focusCap: 3 })

export function useIntentionDay(date: string) {
  return useDualQuery<IntentionDay>({
    queryKey: key(date),
    mockData: mockIntentionDay,
    realFetch: () => intentionApi.day(date),
    realEmpty: EMPTY(date),
  })
}

export function useIntentionActions(date: string) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const patch = (fn: (d: IntentionDay) => IntentionDay) =>
    qc.setQueryData<IntentionDay>(key(date), (d) => (d ? fn(d) : d))
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key(date) })
    qc.invalidateQueries({ queryKey: ['habitDay', date] })
    qc.invalidateQueries({ queryKey: ['dailyQuests', date] })
    qc.invalidateQueries({ queryKey: ['progressionProfile'] })
  }

  const setCreedM = useMutation({
    mutationFn: async (text: string) => {
      if (mock) { patch((d) => ({ ...d, creed: text })); return }
      return intentionApi.setCreed(text).then(() => undefined)
    },
    onSuccess: mock ? undefined : invalidate,
  })
  const addFocusM = useMutation({
    mutationFn: async (text: string) => {
      if (mock) {
        patch((d) => {
          if (d.foci.length >= d.focusCap) return d
          const first = d.foci.length === 0
          if (first) awardGamificationEvent(qc, { type: 'HABIT', xpOverride: 10 })
          return { ...d, foci: [...d.foci, { id: `if-${d.foci.length + 1}-${date}`, focusDate: date, text }] }
        })
        return
      }
      return intentionApi.addFocus(date, text).then(() => undefined)
    },
    onSuccess: mock ? undefined : invalidate,
  })
  const removeFocusM = useMutation({
    mutationFn: async (id: string) => {
      if (mock) { patch((d) => ({ ...d, foci: d.foci.filter((f) => f.id !== id) })); return }
      return intentionApi.removeFocus(id).then(() => undefined)
    },
    onSuccess: mock ? undefined : invalidate,
  })
  const reflectM = useMutation({
    mutationFn: async (value: Reflection) => {
      if (mock) { patch((d) => ({ ...d, reflection: value })); return }
      return intentionApi.reflect(date, value).then(() => undefined)
    },
    onSuccess: mock ? undefined : invalidate,
  })

  return {
    setCreed: (text: string) => setCreedM.mutateAsync(text),
    addFocus: (text: string) => addFocusM.mutateAsync(text),
    removeFocus: (id: string) => removeFocusM.mutateAsync(id),
    reflect: (value: Reflection) => reflectM.mutateAsync(value),
    pending: setCreedM.isPending || addFocusM.isPending || removeFocusM.isPending || reflectM.isPending,
  }
}
