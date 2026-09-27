import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { localDateString } from '@/shared/lib/dates'
import { checkinApi, type CheckInResponse, type SaveCheckInBody } from '@/data/me/biometricsApi'
import { initialCheckins } from '@/data/today/checkins'
import { CHECKIN_ITEM_IDS, mockCheckInPlan, type CheckInPlan } from '@/data/today/checkinPlan'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import type { CheckinItemId, CheckinSlot, CheckinState, CheckinValues } from '@/data/types'

const SLOT_TIMES = initialCheckins.map((c) => c.time)

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Every item's answer as the row carries it (NULL = not answered). */
function allAnswers(row: CheckInResponse): Required<CheckinValues> {
  return {
    energy: row.energy ?? null,
    mood: row.mood ?? null,
    stress: row.stress ?? null,
    body: row.body ?? null,
    mental: row.mental ?? null,
    rested: row.rested ?? null,
    soreness: row.soreness ?? null,
    pain: row.pain == null ? null : row.pain === false ? false
      : { regions: row.painRegions ?? [], intensity: row.painIntensity ?? null },
    motivation: row.motivation ?? null,
    hunger: row.hunger ?? null,
    craving: row.craving == null ? null : { value: row.craving, kinds: row.cravingKinds ?? [] },
    digestion: row.digestion ?? null,
    connection: row.connection ?? null,
    day: row.dayRating ?? null,
  }
}

/** A row's answer set: the asked items (asked + NULL = skipped); a legacy row (no
 *  `askedItems`) keeps only what it answered. `null` when nothing at all was answered — the
 *  values show as soon as ANY item was answered (a quick-exit or partial row included). */
export function valuesOfRow(row: CheckInResponse): CheckinValues | null {
  const all = allAnswers(row)
  const keys = row.askedItems ?? CHECKIN_ITEM_IDS.filter((id) => all[id] != null)
  if (!keys.some((id) => all[id] != null)) return null
  const out: CheckinValues = {}
  for (const id of keys) (out as Record<CheckinItemId, unknown>)[id] = all[id]
  return out
}

/** Server rows overlaid onto the 4 canonical slots. A slot without a row derives its state
 *  from local wall-clock: current window → 'now', past → 'skipped' (honest missed, renders
 *  '—'), future → 'pending'. Exported for tests. */
export function buildDaySlots(rows: CheckInResponse[], now: Date = new Date()): CheckinSlot[] {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return SLOT_TIMES.map((time, i) => {
    const row = rows.find((r) => r.slotTime === time)
    if (row) {
      return {
        time,
        state: (row.state ?? 'done') as CheckinState,
        values: valuesOfRow(row),
        note: row.note ?? null,
        savedAt: row.savedAt,
        askedItems: row.askedItems ?? null,
        adaptiveItem: row.adaptiveItem ?? null,
        adaptiveReason: row.adaptiveReason ?? null,
        quickExit: row.quickExit ?? false,
      }
    }
    const from = minutesOf(time)
    const to = i + 1 < SLOT_TIMES.length ? minutesOf(SLOT_TIMES[i + 1]) : 24 * 60
    const state: CheckinState = nowMin >= to ? 'skipped' : nowMin >= from ? 'now' : 'pending'
    return { time, state, values: null, note: null }
  })
}

const num = (v: number | null | undefined) => v ?? undefined

/** The POST body for a slot: every answered field, the asked items, the question of the day
 *  and the quick-exit flag. A skipped or not-asked item is simply omitted (stored NULL). */
export function toSaveBody(date: string, slot: CheckinSlot): SaveCheckInBody {
  const v = slot.values ?? {}
  const pain = v.pain
  const craving = v.craving
  return {
    date,
    slotTime: slot.time,
    state: slot.state ?? 'done',
    energy: num(v.energy),
    mood: num(v.mood),
    stress: num(v.stress),
    body: num(v.body),
    mental: num(v.mental),
    rested: num(v.rested),
    soreness: num(v.soreness),
    pain: pain == null ? undefined : pain !== false,
    painRegions: pain ? pain.regions : undefined,
    painIntensity: pain ? num(pain.intensity) : undefined,
    motivation: num(v.motivation),
    hunger: num(v.hunger),
    craving: craving ? craving.value : undefined,
    cravingKinds: craving && craving.value >= 4 ? craving.kinds : undefined,
    digestion: num(v.digestion),
    connection: num(v.connection),
    dayRating: num(v.day),
    askedItems: slot.askedItems ?? undefined,
    adaptiveItem: slot.adaptiveItem ?? undefined,
    adaptiveReason: slot.adaptiveReason ?? undefined,
    quickExit: slot.quickExit ?? false,
    note: slot.note ?? undefined,
  }
}

/** The slot's question plan + question of the day (server config in real mode, the mirrored
 *  config in mock mode). Real mode: `null` until the plan lands — never the mock plan. */
export function useCheckInPlan(date: string, slotTime: string) {
  const { data, isPending, isError, refetch } = useDualQuery<CheckInPlan | null>({
    queryKey: ['checkinPlan', date, slotTime],
    mockData: mockCheckInPlan(slotTime),
    realFetch: () => checkinApi.plan(date, slotTime),
    realEmpty: null,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { plan: data, isPending, isError, refetch }
}

/** A day's own verdict — the evening check-in's „A nap mérlege" (1–10), or null when not given.
 *  Shares the `['checkins', date]` read with `useCheckins`; the evening slot wins if several
 *  rows carry one. Mock mode has no stored verdict (the mock day's evening is still ahead). */
export function useCheckinDayRating(date: string): number | null {
  const { data } = useDualQuery<CheckInResponse[]>({
    queryKey: ['checkins', date],
    realFetch: () => checkinApi.listForDay(date),
    mockData: [],
    realEmpty: [],
  })
  const rated = data.filter((r) => r.dayRating != null).sort((a, b) => (a.slotTime < b.slotTime ? 1 : -1))
  return rated[0]?.dayRating ?? null
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
        await mutation.mutateAsync(toSaveBody(date, { ...base[idx], ...data }))
      } else {
        // the full answer set (values + asked items + question of the day + quick exit)
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
