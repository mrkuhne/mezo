import { QueryClient } from '@tanstack/react-query'
import {
  GAMIFICATION_KEY,
  awardGamificationEvent,
} from '@/data/gamification/gamificationStore'
import { gamificationProfileMock } from '@/data/gamification/gamificationMock'
import type { GamificationProfile } from '@/data/gamification/gamificationTypes'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'

const D = '2026-07-18'
const qcWith = (patch: Partial<GamificationProfile> = {}) => {
  const qc = new QueryClient()
  qc.setQueryData(GAMIFICATION_KEY, { ...gamificationProfileMock, ...patch })
  return qc
}
const profile = (qc: QueryClient) => qc.getQueryData<GamificationProfile>(GAMIFICATION_KEY)!

test('awards flat XP and counts the event', () => {
  const qc = qcWith({ lastActiveDate: D }) // same-day: isolate XP from streak logic
  const res = awardGamificationEvent(qc, { type: 'WEIGHT', date: D })
  expect(res.xpAwarded).toBe(10)
  expect(profile(qc).totalXp).toBe(3150)
  expect(profile(qc).dayCounters).toEqual({ date: D, counts: { WEIGHT: 1 } })
})

test('daily cap: second WEIGHT the same day earns nothing', () => {
  const qc = qcWith({ lastActiveDate: D })
  awardGamificationEvent(qc, { type: 'WEIGHT', date: D })
  const res = awardGamificationEvent(qc, { type: 'WEIGHT', date: D })
  expect(res.xpAwarded).toBe(0)
  expect(profile(qc).totalXp).toBe(3150)
})

test('level-up grants +50 coins and toasts the new level', () => {
  const toasts: ToastMessage[] = []
  const off = onToast((t) => toasts.push(t))
  const qc = qcWith({ level: 12, totalXp: 3595, xpInLevel: 515, xpForNext: 520, lastActiveDate: D })
  const res = awardGamificationEvent(qc, { type: 'MEAL', date: D })
  off()
  expect(res.leveledUp).toBe(true)
  expect(res.newLevel).toBe(13)
  expect(profile(qc).coins).toBe(240 + 50)
  expect(toasts.at(-1)).toEqual({ kind: 'success', text: '🎉 Szint 13 — +50 🪙' })
})

test('streak: continues from yesterday and pays the 7-day milestone once', () => {
  const qc = qcWith({ lastActiveDate: '2026-07-17', streakDays: 6 })
  awardGamificationEvent(qc, { type: 'SLEEP', date: D })
  expect(profile(qc).streakDays).toBe(7)
  expect(profile(qc).coins).toBe(240 + 50) // 7-day milestone
  awardGamificationEvent(qc, { type: 'MEAL', date: D }) // same day: no double count
  expect(profile(qc).streakDays).toBe(7)
  expect(profile(qc).coins).toBe(240 + 50)
})

test('seeded lastActiveDate=null counts as yesterday', () => {
  const qc = qcWith() // seed: streakDays 6, lastActiveDate null
  awardGamificationEvent(qc, { type: 'WEIGHT', date: D })
  expect(profile(qc).streakDays).toBe(7)
})

test('one missed day + a saver: saver is consumed, streak survives', () => {
  const qc = qcWith({ lastActiveDate: '2026-07-16', streakDays: 9, streakSavers: 1 })
  awardGamificationEvent(qc, { type: 'MEAL', date: D })
  expect(profile(qc).streakDays).toBe(10)
  expect(profile(qc).streakSavers).toBe(0)
})

test('missed days without saver reset the streak to 1', () => {
  const qc = qcWith({ lastActiveDate: '2026-07-14', streakDays: 9, streakSavers: 2 })
  awardGamificationEvent(qc, { type: 'MEAL', date: D })
  expect(profile(qc).streakDays).toBe(1)
  expect(profile(qc).streakSavers).toBe(2) // saver only bridges exactly one missed day
})

test('a capped (0 XP) event does not touch the streak', () => {
  const qc = qcWith({ lastActiveDate: '2026-07-17', streakDays: 6 })
  awardGamificationEvent(qc, { type: 'WEIGHT', date: D })
  awardGamificationEvent(qc, { type: 'WEIGHT', date: D }) // capped
  expect(profile(qc).dayCounters.counts.WEIGHT).toBe(2)
  expect(profile(qc).streakDays).toBe(7)
})
