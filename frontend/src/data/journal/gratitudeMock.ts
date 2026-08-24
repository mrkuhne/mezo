import type { GratitudeEntry } from '@/data/journal/journalTypes'

/** Mock seed: 6 Hungarian gratitude entries spanning 4 consecutive days ending 2026-08-20,
 * newest first — so the mock streak is visibly ≥3. Two entries share the same day. */
export const mockGratitudeEntries: GratitudeEntry[] = [
  {
    id: 'g6',
    occurredOn: '2026-08-20',
    text: 'Hála a hűvös esti szellőnek a nap után.',
    lifeArea: 'mindfulness',
    createdAt: '2026-08-20T21:00:00Z',
  },
  {
    id: 'g5',
    occurredOn: '2026-08-20',
    text: 'Köszönhetően a kollégának, megértettem a PR feedback-et.',
    lifeArea: 'connection',
    createdAt: '2026-08-20T14:30:00Z',
  },
  {
    id: 'g4',
    occurredOn: '2026-08-19',
    text: 'Reggeli futás a hűvösben — éreztem az energiát.',
    lifeArea: 'recovery',
    createdAt: '2026-08-19T07:15:00Z',
  },
  {
    id: 'g3',
    occurredOn: '2026-08-18',
    text: 'Jó volt a hétvége, pihentem egy jót.',
    lifeArea: null,
    createdAt: '2026-08-18T20:00:00Z',
  },
  {
    id: 'g2',
    occurredOn: '2026-08-17',
    text: 'Tanultam valamit újról a konyhában.',
    lifeArea: 'cooking',
    createdAt: '2026-08-17T19:45:00Z',
  },
  {
    id: 'g1',
    occurredOn: '2026-08-16',
    text: 'Köszönhetően a kávé, ma is jól indult a nap.',
    lifeArea: null,
    createdAt: '2026-08-16T08:00:00Z',
  },
]
