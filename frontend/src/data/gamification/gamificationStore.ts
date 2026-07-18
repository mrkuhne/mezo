import type { QueryClient } from '@tanstack/react-query'
import { levelFromTotalXp } from '@/data/gamification/levelCurve'
import { gamificationProfileMock } from '@/data/gamification/gamificationMock'
import type { GamificationProfile, XpEventType } from '@/data/gamification/gamificationTypes'
import { xpForEvent } from '@/data/gamification/xpValues'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'

export const GAMIFICATION_KEY = ['gamification'] as const
export const SAVER_PRICE = 200
export const MAX_SAVERS = 2
export const LEVEL_UP_COINS = 50
export const STREAK_MILESTONE_COINS: Record<number, number> = { 7: 50, 30: 150, 100: 500 }

export type AwardResult = {
  xpAwarded: number
  coinsAwarded: number
  leveledUp: boolean
  newLevel: number
}

const dayDiff = (fromIso: string, toIso: string): number =>
  Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)

/** Mock-mode account progression: XP (capped), daily streak (+saver), coins, level-ups.
 *  Called from the mock arms of every logging mutation (spec §4.3). Emits ONE toast per
 *  award — level-up > streak milestone > saver notice > plain XP. Real mode never calls
 *  this; the backend will award server-side (mezo-huzd). */
export function awardGamificationEvent(
  qc: QueryClient,
  event: { type: XpEventType; date?: string; xpOverride?: number },
): AwardResult {
  const today = event.date ?? localDateString()
  const prev = qc.getQueryData<GamificationProfile>(GAMIFICATION_KEY) ?? gamificationProfileMock

  const counters = prev.dayCounters.date === today ? prev.dayCounters.counts : {}
  const countToday = counters[event.type] ?? 0
  const xp = xpForEvent(event.type, countToday, event.xpOverride)

  let next: GamificationProfile = {
    ...prev,
    dayCounters: { date: today, counts: { ...counters, [event.type]: countToday + 1 } },
  }

  if (xp === 0) {
    qc.setQueryData(GAMIFICATION_KEY, next)
    return { xpAwarded: 0, coinsAwarded: 0, leveledUp: false, newLevel: next.level }
  }

  let coinsAwarded = 0
  let milestone = 0
  let saverUsed = false
  if (next.lastActiveDate !== today) {
    const gap = next.lastActiveDate == null ? 1 : dayDiff(next.lastActiveDate, today)
    if (gap === 1) {
      next = { ...next, streakDays: next.streakDays + 1 }
    } else if (gap === 2 && next.streakSavers > 0) {
      next = { ...next, streakDays: next.streakDays + 1, streakSavers: next.streakSavers - 1 }
      saverUsed = true
    } else {
      next = { ...next, streakDays: 1 }
    }
    next = { ...next, lastActiveDate: today }
    milestone = STREAK_MILESTONE_COINS[next.streakDays] ?? 0
    coinsAwarded += milestone
  }

  const totalXp = next.totalXp + xp
  const { level, xpInLevel, xpForNext } = levelFromTotalXp(totalXp)
  const leveledUp = level > next.level
  if (leveledUp) coinsAwarded += LEVEL_UP_COINS

  next = { ...next, totalXp, level, xpInLevel, xpForNext, coins: next.coins + coinsAwarded }
  qc.setQueryData(GAMIFICATION_KEY, next)

  if (leveledUp) emitToast({ kind: 'success', text: `🎉 Szint ${level} — +${LEVEL_UP_COINS} 🪙` })
  else if (milestone > 0)
    emitToast({ kind: 'success', text: `🔥 ${next.streakDays} napos sorozat — +${milestone} 🪙` })
  else if (saverUsed)
    emitToast({ kind: 'info', text: '🧊 Streak-mentő elhasználva — a sorozat megmaradt' })
  else emitToast({ kind: 'success', text: `+${xp} XP` })

  return { xpAwarded: xp, coinsAwarded, leveledUp, newLevel: level }
}
