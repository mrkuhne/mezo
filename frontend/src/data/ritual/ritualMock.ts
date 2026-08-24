import type { RitualDay } from '@/data/types'

/** Seed: the demo evening — 22:30 bed anchor, window open, day not yet closed. */
export const mockRitualDay = (date: string): RitualDay => ({
  date,
  closed: false,
  closedAt: null,
  reflectionText: null,
  window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
})

/** Real-mode empty (dual-mode invariant): never the seed; ghost window mirrors the backend's
 *  no-goal config default (bed 22:00). */
export const EMPTY_RITUAL_DAY = (date: string): RitualDay => ({
  date,
  closed: false,
  closedAt: null,
  reflectionText: null,
  window: { opensAt: '20:45', prepStartsAt: '21:15', bedTime: '22:00' },
})
