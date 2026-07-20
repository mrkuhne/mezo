import type { IntentionDay } from '@/data/types'

/** Deterministic seed: a creed + 2 foci, no reflection yet. */
export const mockIntentionDay: IntentionDay = {
  date: '2026-07-20',
  creed: 'Minden döntésem a célom felé visz — szándékkal élek, nem sodródom.',
  foci: [
    { id: 'if1', focusDate: '2026-07-20', text: 'Jelen lenni minden beszélgetésben — nem fél füllel.' },
    { id: 'if2', focusDate: '2026-07-20', text: 'Az edzésen a formára figyelek, nem a súlyra.' },
  ],
  reflection: null,
  focusCap: 3,
}
