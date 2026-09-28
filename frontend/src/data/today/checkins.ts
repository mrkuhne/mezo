import type { CheckinSlot } from '@/data/types'

// Mock day (Check-in 2.0, mezo-ck2) — the Nap living prototype's `SLOTS`: a full morning
// (plan + the question of the day, pain in the knee), a quick-exit late morning, the afternoon
// due now, the evening ahead.
export const initialCheckins: CheckinSlot[] = [
  {
    time: '06:30', state: 'done',
    values: {
      energy: 7, mood: 8, stress: 3, body: 6, mental: 7, rested: 6, soreness: 5,
      pain: { regions: ['TERD'], intensity: 4 }, motivation: 8, hunger: 5,
    },
    note: 'Nyugodt ébredés · pihenve',
    askedItems: ['energy', 'mood', 'stress', 'body', 'mental', 'rested', 'soreness', 'pain', 'motivation', 'hunger'],
    adaptiveItem: 'hunger', adaptiveReason: 'NEED', quickExit: false,
  },
  {
    time: '10:00', state: 'done',
    values: { energy: 8, mood: 7, stress: 4, body: 7, mental: 8 },
    note: null,
    askedItems: ['energy', 'mood', 'stress', 'body', 'mental'],
    adaptiveItem: 'craving', adaptiveReason: 'RANDOM', quickExit: true,
  },
  { time: '14:00', state: 'now', values: null, note: null },
  { time: '20:00', state: 'pending', values: null, note: null },
]
