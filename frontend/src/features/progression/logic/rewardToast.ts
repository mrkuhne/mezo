// ============================================================
// Mezo · rewardToast — the payload-builder layer of the DS §Notification toast
// system (mezo-k5sa). PURE: no DOM, no hooks, no query client — it only maps what a
// call site already knows (+ the server's LevelUpResult when there is one) onto a
// RewardToast. The config layer the DS reference implementation describes lives in
// OUR backend (ProgressionService decides the XP and the level threshold), so there is
// deliberately no FE-side reward config here — that would be a second source of truth.
// ============================================================
import type { LevelUpResult } from '@/data/train/trainApi'
import { skillDisplay } from '@/features/progression/logic/levelUpMeta'
import type { RewardToast } from '@/shared/lib/toastBus'

/** The meter row + level-up badge, derived from the server's payload.
 *  A habit award always writes exactly ONE gain (ProgressionService.applyHabit puts a
 *  single skillKey in the delta map), so gains[0] is the whole story — no picking needed. */
function fromLevelUp(levelUp: LevelUpResult | null | undefined): Pick<RewardToast, 'meter' | 'levelUp'> {
  const gain = levelUp?.gains?.[0]
  if (!gain) return {}
  const { name } = skillDisplay(gain.skillKey, gain.kind, gain.name)
  return {
    meter: { label: name, delta: gain.xpGained },
    // Only a REAL level crossing earns the badge — a gain that merely accrued XP does not.
    ...(gain.levelAfter > gain.levelBefore
      ? { levelUp: { label: name, from: gain.levelBefore, to: gain.levelAfter } }
      : {}),
  }
}

/**
 * Habit check → reward toast.
 *
 * `chainDone` is the chain's completed count BEFORE this check; the eyebrow shows
 * `chainDone + 1` because the row this toast celebrates is now done — the same number the
 * list prints a moment later. `chainTotal === 0` means the call site has no chain context
 * (e.g. the wind-down banner), and the eyebrow drops the counter rather than printing „· 1 / 0".
 *
 * Mock mode resolves `check()` to undefined (no LevelUpResult exists), so the meter falls back
 * to `{ label: 'XP', delta: xp }` — 'XP' is literally what was awarded. We never invent a skill
 * name the mock data does not carry.
 */
export function buildHabitRewardToast(input: {
  title: string
  chainDone: number
  chainTotal: number
  xp: number
  levelUp?: LevelUpResult | null
  /** a szokás saját ünneplés-mondata a katalógusból; hiányában a toast a régi marad —
   *  generikus fallback szándékosan nincs (mezo-3zue.5) */
  celebration?: string | null
}): RewardToast {
  const { title, chainDone, chainTotal, xp, levelUp, celebration } = input
  const fromServer = fromLevelUp(levelUp)
  const meter = fromServer.meter ?? (xp > 0 ? { label: 'XP', delta: xp } : undefined)
  return {
    kind: 'reward',
    eyebrow: chainTotal > 0 ? `Szokás · ${chainDone + 1} / ${chainTotal}` : 'Szokás',
    title,
    ...(celebration ? { celebration } : {}),
    ...(meter ? { meter } : {}),
    ...(fromServer.levelUp ? { levelUp: fromServer.levelUp } : {}),
  }
}

/**
 * Quest completion / activity log → reward toast. No chain counter exists for these, so the
 * eyebrow is a fixed label („Küldetés", or „Naplózva" for the activity sheet). With no
 * LevelUpResult the toast is eyebrow + title alone — a complete, honest confirmation.
 */
export function buildQuestRewardToast(input: {
  title: string
  meta?: string
  eyebrow?: string
  levelUp?: LevelUpResult | null
}): RewardToast {
  const { title, meta, eyebrow = 'Küldetés', levelUp } = input
  const fromServer = fromLevelUp(levelUp)
  return {
    kind: 'reward',
    eyebrow,
    title,
    ...(meta ? { meta } : {}),
    ...(fromServer.meter ? { meter: fromServer.meter } : {}),
    ...(fromServer.levelUp ? { levelUp: fromServer.levelUp } : {}),
  }
}
