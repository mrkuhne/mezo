import type { CheckinSlot } from './types'

export const initialCheckins: CheckinSlot[] = [
  { time: '06:30', state: 'done', values: { energy: 7, stress: 3, body: 6, mental: 7 }, note: 'Reta D2 reggel · pihenve' },
  { time: '10:00', state: 'done', values: { energy: 8, stress: 4, body: 7, mental: 8 }, note: null },
  { time: '14:00', state: 'now', values: null, note: null },
  { time: '20:00', state: 'pending', values: null, note: null },
]
