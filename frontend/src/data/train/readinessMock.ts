import type { ReadinessTodayResponse } from '@/data/train/readinessApi'

/**
 * Mock-mode seed of the Edzés readiness card (Check-in 2.0, mezo-ck2) — the approved prototype's
 * content (`elo/edzes.html` `readyCard()`): a tired, sore morning (Kipihentség 4/10, Izomláz 7/10,
 * Kedv 5/10) and a sore shoulder that flags the Pull day's Rear Delt Fly.
 */
export const readinessMock: ReadinessTodayResponse = {
  suggest: true,
  state: 'OFFER',
  reasons: [
    { item: 'rested', value: 4 },
    { item: 'soreness', value: 7 },
    { item: 'motivation', value: 5 },
  ],
  care: [
    { exerciseName: 'Rear Delt Fly', region: 'VALL', regionLabel: 'vállad', intensity: 5 },
  ],
}

/** Real-mode placeholder while the read is unresolved — never the mock seed. */
export const readinessEmpty: ReadinessTodayResponse = {
  suggest: false,
  state: 'NONE',
  reasons: [],
  care: [],
}
