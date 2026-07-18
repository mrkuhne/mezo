import { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

// The Heartbeat strip's data: mock mode keeps the Phase-1 seed; real mode READS today's
// persisted rows (GET /api/biometrics/checkin?date=…, the previously-unconsumed listForDay)
// and overlays them onto the 4 canonical slots. A local optimistic layer keeps a just-saved
// slot flipped immediately in both modes; the real save invalidates the day query so the
// strip reconciles with the server (the response is no longer discarded fire-and-forget).
export function useCheckins() {
  const mock = isMockMode()
  const qc = useQueryClient()
  const date = localDateString()
  const [local, setLocal] = useState<Record<number, Partial<CheckinSlot>>>({})
  const { data: rows } = useQuery({
    queryKey: ['checkins', date],
    queryFn: () => checkinApi.listForDay(date),
    enabled: !mock,
  })
  const mutation = useMutation({
    mutationFn: checkinApi.save,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkins', date] }),
    onError: (err) => console.error('Check-in sync failed', err),
  })
  const base = mock ? initialCheckins : buildDaySlots(rows ?? [])
  const checkins = base.map((c, i) => (local[i] ? { ...c, ...local[i] } : c))
  const saveCheckIn = useCallback(
    (idx: number, data: Partial<CheckinSlot>) => {
      setLocal((prev) => ({ ...prev, [idx]: { ...prev[idx], ...data } }))
      if (!mock) {
        const slot = { ...base[idx], ...local[idx], ...data }
        const v = slot.values
        mutation.mutate({
          date, slotTime: slot.time, state: slot.state ?? 'done',
          energy: v?.energy, stress: v?.stress, body: v?.body, mental: v?.mental,
          note: slot.note ?? undefined,
        })
      } else {
        awardGamificationEvent(qc, { type: 'CHECKIN' })
      }
    },
    [mock, base, local, mutation, date, qc],
  )
  return { checkins, saveCheckIn }
}
