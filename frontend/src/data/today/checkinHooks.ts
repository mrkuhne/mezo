import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { localDateString } from '@/shared/lib/dates'
import { checkinApi } from '@/data/me/biometricsApi'
import { initialCheckins } from '@/data/today/checkins'
import type { CheckinSlot } from '@/data/types'

export function useCheckins() {
  const [checkins, setCheckins] = useState<CheckinSlot[]>(initialCheckins)
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: checkinApi.save,
    onError: (err) => console.error('Check-in sync failed', err),
  })
  const saveCheckIn = useCallback((idx: number, data: Partial<CheckinSlot>) => {
    setCheckins(prev => {
      const next = prev.map((c, i) => (i === idx ? { ...c, ...data } : c))
      if (!mock) {
        const slot = next[idx]
        const v = slot.values
        const today = localDateString()
        mutation.mutate({
          date: today, slotTime: slot.time, state: slot.state ?? 'done',
          energy: v?.energy, stress: v?.stress, body: v?.body, mental: v?.mental,
          note: slot.note ?? undefined,
        })
      }
      return next
    })
  }, [mock, mutation])
  return { checkins, saveCheckIn }
}
