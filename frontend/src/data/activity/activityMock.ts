import type { ActivityEntry } from '@/data/types'

/** Mock seed: a representative day — 2 categorized entries + 1 uncategorized prompt. */
export const mockActivities: ActivityEntry[] = [
  {
    id: 'act1',
    occurredOn: '2026-07-11',
    text: 'Olvastam 30 percet a Psychology of Money-ból',
    skillKey: 'learning',
    confidence: 0.92,
    xpAwarded: 18,
    durationMin: 30,
    amountHuf: null,
    categorizedBy: 'AI',
    createdAt: '2026-07-11T08:10:00Z',
  },
  {
    id: 'act2',
    occurredOn: '2026-07-11',
    text: 'Átraktam 50 ezret megtakarításba',
    skillKey: 'financial',
    confidence: 0.88,
    xpAwarded: 15,
    durationMin: null,
    amountHuf: 50000,
    categorizedBy: 'AI',
    createdAt: '2026-07-11T09:30:00Z',
  },
  {
    id: 'act3',
    occurredOn: '2026-07-11',
    text: 'Rendet raktam a garázsban',
    skillKey: null,
    confidence: 0.4,
    xpAwarded: 0,
    durationMin: null,
    amountHuf: null,
    categorizedBy: null,
    createdAt: '2026-07-11T11:05:00Z',
  },
]
