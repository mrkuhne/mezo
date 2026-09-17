import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { localDateString } from '@/shared/lib/dates'
import { checkinApi, type CheckInResponse } from '@/data/me/biometricsApi'
import { initialCheckins } from '@/data/today/checkins'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import type { CheckinSlot, CheckinState } from '@/data/types'

const SLOT_TIMES = initialCheckins.map((c) => c.time)

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Server rows overlaid onto the 4 canonical slots. A slot without a row derives its state
 *  from local wall-clock: current window → 'now', past → 'skipped' (honest missed, renders
 *  '—'), future → 'pending'. Exported for tests. */
export function buildDaySlots(rows: CheckInResponse[], now: Date = new Date()): CheckinSlot[] {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return SLOT_TIMES.map((time, i) => {
    const row = rows.find((r) => r.slotTime === time)
    if (row) {
      const hasValues = row.energy != null && row.stress != null && row.body != null && row.mental != null
      return {
        time,
        state: (row.state ?? 'done') as CheckinState,
        values: hasValues
          ? { energy: row.energy!, stress: row.stress!, body: row.body!, mental: row.mental! }
          : null,
        note: row.note ?? null,
        savedAt: row.savedAt,
      }
    }
    const from = minutesOf(time)
    const to = i + 1 < SLOT_TIMES.length ? minutesOf(SLOT_TIMES[i + 1]) : 24 * 60
    const state: CheckinState = nowMin >= to ? 'skipped' : nowMin >= from ? 'now' : 'pending'
    return { time, state, values: null, note: null }
  })
}

// Real slots reflect persisted server rows only. Mock edits belong to one local date.
export function useCheckins() {
  const mock = isMockMode()
  const qc = useQueryClient()
  const date = localDateString()
  const [local, setLocal] = useState<{ date: string; slots: Record<number, Partial<CheckinSlot>> }>({ date, slots: {} })
  const { data: rows, isPending, isError, refetch } = useDualQuery<CheckInResponse[]>({
    queryKey: ['checkins', date],
    realFetch: () => checkinApi.listForDay(date),
    mockData: [],
    realEmpty: [],
  })
  const mutation = useMutation({
    mutationFn: checkinApi.save,
    onSuccess: (_response, saved) => {
      qc.invalidateQueries({ queryKey: ['checkins', saved.date] })
      // Quest evaluation is read-triggered: the 4th saved slot can complete a checkin_full
      // quest, so nudge the day's quest read for same-screen feedback.
      qc.invalidateQueries({ queryKey: ['dailyQuests', saved.date] })
    },
    onError: (err) => console.error('Check-in sync failed', err),
  })
  const base = mock ? initialCheckins : buildDaySlots(rows ?? [])
  const edits = mock && local.date === date ? local.slots : {}
  const checkins = base.map((c, i) => (edits[i] ? { ...c, ...edits[i] } : c))
  const saveCheckIn = useCallback(
    async (idx: number, data: Partial<CheckinSlot>) => {
      if (!mock) {
        const slot = { ...base[idx], ...data }
        const v = slot.values
        await mutation.mutateAsync({
          date, slotTime: slot.time, state: slot.state ?? 'done',
          energy: v?.energy, stress: v?.stress, body: v?.body, mental: v?.mental,
          note: slot.note ?? undefined,
        })
      } else {
        setLocal(prev => {
          const slots = prev.date === date ? prev.slots : {}
          return { date, slots: { ...slots, [idx]: { ...slots[idx], ...data } } }
        })
        awardGamificationEvent(qc, { type: 'CHECKIN' })
      }
    },
    [mock, base, mutation, date, qc],
  )
  return { checkins, saveCheckIn, isPending, isError, refetch }
}
