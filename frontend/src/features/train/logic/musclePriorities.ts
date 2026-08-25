// ============================================================
// Mezo · musclePriorities — tier helpers for the per-mesocycle muscle
// priority picker (mezo-3m5m, spec GD4). A sparse MusclePriorities map picks
// which volume landmark is "100%" for the weekly ramp: emphasize -> MRV,
// grow (default/absent key) -> MAV, maintain -> MEV (flat, no ramp).
// TIER_GROUPS are the 9 landmark groups from setBudget's GROUP_MEV —
// traps/core are intentionally absent (spec "no row, no tier"), matching
// their ~0 MEV treatment in the set-budget model.
// ============================================================
import type { MusclePriorities, MuscleTier } from '@/data/types'

export const TIER_GROUPS = ['chest', 'back', 'shoulder', 'biceps', 'triceps', 'quad', 'ham', 'glute', 'calf'] as const

export const TIER_LABELS: Record<MuscleTier, string> = {
  emphasize: 'Emphasize',
  grow: 'Grow',
  maintain: 'Maintain',
}

// Spec cap: at most this many groups can be Emphasize at once — the ramp only
// has room for a couple of MRV-target groups before the weekly budget breaks.
export const EMPHASIZE_CAP = 2

/** Current tier for a group; absent/unknown key (or a null/undefined map) defaults to 'grow'. */
export function tierOf(priorities: MusclePriorities | null | undefined, group: string): MuscleTier {
  return priorities?.[group] ?? 'grow'
}

/** Returns a NEW sparse map with `group` set to `tier`. Setting 'grow' deletes the key. */
export function setTier(priorities: MusclePriorities, group: string, tier: MuscleTier): MusclePriorities {
  const next = { ...priorities }
  if (tier === 'grow') {
    delete next[group]
  } else {
    next[group] = tier
  }
  return next
}

/** The weekly landmark a tier ramps to: emphasize -> MRV, grow -> MAV, maintain -> MEV (flat). */
export function tierTargetOf(tier: MuscleTier, lm: { mev: number; mav: number; mrv: number }): number {
  if (tier === 'emphasize') return lm.mrv
  if (tier === 'maintain') return lm.mev
  return lm.mav
}
